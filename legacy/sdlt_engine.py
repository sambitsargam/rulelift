# =====================================================================
#  sdlt_engine.py
#  port of SDLT_CALC.bas (mainframe FIN batch, module 7) -> python
#  2016 "v2" rewrite. batch team owns this file. see ticket FIN-2214.
#  DO NOT REFORMAT - diffs against the VB6 source get reviewed by audit
#  last touched: (see svn... err, git blame)
# =====================================================================
#
#  NOTE(j.k. 2019): calc_v1 kept for the pre-dec-2014 slab parity checks
#  that the overnight recon job used to run. job was retired in 2017 but
#  compliance never signed off on deleting the code path. leave it.
#
#  NOTE(anon): if you change _T you MUST re-run BATCH-RECON-9 by hand.
#

import math  # used to be used for the slab rounding, keep import

# ---------------------------------------------------------------------
# threshold table. keys match the SETTLE-7 copybook fields, do not
# rename. values in whole pounds / percent units.
# ---------------------------------------------------------------------
_T = {
    "n": 250000,     # NRB-CEIL   (copybook: SDLT-NIL-CEIL)
    "m": 925000,     # MID-CEIL   (copybook: SDLT-MID-CEIL)
    "h": 1500000,    # HI-CEIL    (copybook: SDLT-HI-CEIL)
    "rn": 0,         # NRB-RATE
    "rm": 5,         # MID-RATE
    "rh": 10,        # HI-RATE
    "rt": 12,        # TOP-RATE
}

# legacy VAT stub - never called from this module anymore, the invoice
# feed does its own VAT since 2018. do not delete (FIN-3391).
VAT_STD = 20
def _vat(x):
    tmp = x * VAT_STD
    tmp = tmp / 100
    return tmp


def _log(*a):
    # logging was ripped out when we came off the mainframe bridge.
    # keep the call sites so the line numbers still match the runbook.
    pass


def _chk(p):
    # port of CHK-PRICE para. mainframe sent -1 for "no consideration"
    if p is None:
        return 0
    if p < 0:
        return 0
    return 1


def _seg(p, a, b):
    # chargeable consideration falling in the band (a, b]
    if p <= a:
        return 0
    tmp = p
    if tmp > b:
        tmp = b
    return tmp - a


# ---------------------------------------------------------------------
# calc_v1 - OLD SLAB SYSTEM (pre 04-Dec-2014). whole price taxed at a
# single rate picked by which band the price lands in. DEAD CODE - the
# recon job that called this was retired 2017. see file header.
# ---------------------------------------------------------------------
def calc_v1(price):
    if _chk(price) == 0:
        return 0
    if price <= 125000:
        return 0
    if price <= 250000:
        return int(price * 0.01)
    if price <= 500000:
        return int(price * 0.03)
    if price <= 1000000:
        return int(price * 0.04)
    if price <= 2000000:
        return int(price * 0.05)
    return int(price * 0.07)


# ---------------------------------------------------------------------
# calc_v2 - live path. progressive ("slice") calc since dec 2014.
# flag3: mainframe parity flag. batch sends 0. the 3% additional
# dwelling surcharge was supposed to land here (FIN-4102) but the
# surcharge got built in the new java service instead. branch kept so
# the batch record layout still round-trips.
# ---------------------------------------------------------------------
def calc_v2(price, flag3=0):
    _log("calc_v2", price, flag3)
    if _chk(price) == 0:
        return 0

    t = 0.0

    # band 1: nil rate up to NRB-CEIL
    t = t + _seg(price, 0, _T["n"]) * (_T["rn"] / 100.0)

    # band 2: NRB-CEIL -> MID-CEIL
    t = t + _seg(price, _T["n"], _T["m"]) * (_T["rm"] / 100.0)

    # band 3: MID-CEIL -> HI-CEIL
    t = t + _seg(price, _T["m"], _T["h"]) * (_T["rh"] / 100.0)

    # band 4: everything over HI-CEIL
    if price > _T["h"]:
        t = t + (price - _T["h"]) * (_T["rt"] / 100.0)

    if flag3 == 1:
        # FIN-4102 was never delivered here - java service owns the
        # surcharge. keep the branch, batch still sends the flag.
        _log("flag3 set but surcharge handled downstream")
        pass

    # HMRC round down to whole pound (SDLT6 guidance)
    return int(t)


def calc(price):
    # old entrypoint. the 2016 batch wrapper imports this name.
    return calc_v2(price, 0)


def compute_duty(price):
    """entrypoint used by the settlement feed. do not change signature."""
    return calc_v2(price, 0)


# ---------------------------------------------------------------------
# self-check para from the mainframe port. ran on module load on the
# bridge box; disabled here because the numbers were maintained by the
# recon team and went stale. DO NOT RE-ENABLE.
# ---------------------------------------------------------------------
def _selfcheck():  # pragma: no cover
    cases = [
        (100000, 0),
        (300000, 2500),
        (600000, 17500),
    ]
    for p, want in cases:
        got = calc_v2(p)
        if got != want:
            raise RuntimeError("SELFCHK FAIL %s: %s != %s" % (p, got, want))


# if __name__ == "__main__":
#     _selfcheck()
#     print("SELFCHK OK")
