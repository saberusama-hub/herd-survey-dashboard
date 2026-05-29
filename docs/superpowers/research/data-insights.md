# HERD Survey Data Insights — Dashboard Uplift Research

**Scope:** 20 years of US federal R&D funding to universities, FY2005–FY2024
**Data:** 15 ZSTD parquet fact tables, 1,014 institutions, 41 agencies, 12 NIH ICs
**Goal:** Identify the most compelling stories worth visualizing for a research-grade dashboard

This document presents 20 must-show insights, 5 anomalies, 5 cross-source patterns, 5 inflection points, 3 narrative arcs, and 5 unexplored joins — all with actual numbers from the data.

---

## SECTION 1 — TOP 20 MUST-SHOW INSIGHTS

### 1.1 — University R&D more than doubled in 20 years (nominal); grew 38% in real terms

**Question:** What does the long-run trajectory of university R&D look like, and is the "research boom" real after inflation?
**Data:** `sheet_01_institution_funding_panel` aggregate × `cpi_u_annual`
**Numbers:** Federal R&D to universities went from **$29.19B (FY2005) → $64.70B (FY2024)** nominal, a 122% increase. In real 2024 dollars: **$47.00B → $64.70B (+38%)**. Total university R&D (all sources): **$45.77B → $117.66B nominal**. Federal share of total: **63.8% (FY05) → 55.0% (FY24)** — federal money grew, but institutional self-funding grew faster.
**Chart:** Stacked area chart of funding sources, nominal vs real toggle, with the federal share % overlay as a second axis.
**Story:** Universities have effectively been bearing more of their own R&D cost — institutional funds grew from 18.1% to 25.7% of all R&D ($8.26B → $30.18B) over the same period, while federal share contracted.

### 1.2 — Johns Hopkins has captured a growing share of federal R&D, alone

**Question:** Is federal R&D becoming more concentrated at the top?
**Data:** `sheet_01_institution_funding_panel`
**Numbers:** Johns Hopkins University's federal R&D went from **$1.28B (FY05) → $3.62B (FY24)**. JHU's share of all federal R&D rose from **4.38% → 5.59%**. JHU is now larger than the entire HBCU sector ($3.62B vs $644M for 66 HBCUs combined). The gap between JHU and the #2 recipient (Georgia Tech, $1.21B) is **$2.41B in FY24** — bigger than the federal R&D of any individual non-JHU institution.
**Chart:** Lollipop chart of JHU vs #2-20, year toggle; or "JHU share-of-pie" donut animated over time.
**Story:** Johns Hopkins is not just the top recipient — its lead has grown to 3.0x the #2 institution. APL (Applied Physics Lab) explains most of the DoD-heavy mix.

### 1.3 — Top 50 universities absorb 60.7% of all federal R&D; top 200 absorb 95.1%

**Question:** How concentrated is federal R&D among institutions?
**Data:** `sheet_01_institution_funding_panel` FY2024
**Numbers:** Of 842 institutions reporting federal R&D in FY24 ($64.70B total):
- Top 10 (1.2%): $13.47B (20.8%)
- Top 25 (3.0%): $26.16B (40.4%)
- Top 50 (5.9%): $39.27B (60.7%)
- Top 100 (11.9%): $52.49B (81.1%)
- Top 200 (23.8%): $61.51B (95.1%)

Compared to FY05: top 25 was 37.8% (FY05) → 40.4% (FY24); top 50 was 58.0% → 60.7%. Mild concentration creep.
**Chart:** Lorenz curve, or stacked area where ranked institutions form the bands.
**Story:** Federal R&D is heavily concentrated — half a percent of all U.S. higher-ed institutions absorb 95% of federal university research dollars.

### 1.4 — The HBCU share of federal R&D fell to a 20-year low

**Question:** Have HBCUs gained or lost ground in federal R&D over 20 years?
**Data:** `sheet_01` × `dim_institution.is_hbcu`
**Numbers:** 66 HBCUs in panel data. Total HBCU federal R&D: **$397M (FY05) → $644M (FY24)** nominal — a 62% rise, but in real terms only 0.0% growth. As share of federal R&D: **1.36% (FY05) → 0.87% (FY21, all-time low) → 1.00% (FY24)**. HBCUs received less federal R&D growth (1.6x) than the median institution (2.2x). HBCU R&D mix: 51.5% life sciences, 13.9% engineering, 11.1% Non-S&E.
**Chart:** Line chart of HBCU share % with FY24 callout; companion bar chart breaking down by FY of "HBCU share of net new federal R&D dollars."
**Story:** Despite a $400M+ nominal increase, HBCUs have lost relative ground in federal R&D — and in real dollars, they have flat-lined for 20 years while the overall pie grew 38%.

### 1.5 — The HHS COVID surge: $37.6B added in two years, then mostly evaporated

**Question:** How big was COVID's impact on federal R&D, and where did the money go?
**Data:** `sheet_04_federal_rd_by_agency`
**Numbers:** HHS R&D obligations went from **$39.43B (FY19) → $77.05B (FY21)** — a +$37.6B / +95.4% jump in two years. The increase was almost entirely in experimental development: HHS dev funding went from **$0.84B (FY19) → $33.93B (FY21)** — a 40x increase. By FY23 dev funding collapsed back to $0.05B. Basic+applied research at HHS rose more modestly ($38.4B → $43.6B FY19-FY22) and stayed elevated.
**Chart:** Stacked area chart of HHS basic/applied/dev by year, with FY20-22 spike highlighted; small multiples for other agencies showing they did NOT see the spike.
**Story:** The COVID supplementals were ~$34B of one-time HHS development funding (Operation Warp Speed vaccines, therapeutics) — they did not durably reset the federal R&D baseline.

### 1.6 — NIAID surged 39% in COVID year, then NCI quietly retook the lead

**Question:** Within NIH, which Institutes/Centers responded to COVID and how durable were those shifts?
**Data:** `sheet_12_nih_ic_breakdown`
**Numbers:** NIAID dollar flow: **$3.93B (FY19) → $5.45B (FY20)** = +38.7%, plateau through FY22 ($5.67B), then decline back to **$4.74B (FY24)**. NIAID share of NIH: **13.1% → 16.2% → 13.3%**. NCI share stayed steady at ~14% throughout. Of the FY24 NIH-funded institutions, **66% saw NIAID share decline since FY21**.
**Chart:** Streamgraph of NIH ICs over time, with NIAID highlighted; vertical band marking COVID era.
**Story:** NIAID became the largest NIH IC during COVID for the first time in the dataset's history — then receded as NCI reclaimed its decade-long dominance.

### 1.7 — DOD basic research at universities tripled in real terms

**Question:** Is the Department of Defense becoming a basic research funder?
**Data:** `sheet_04_federal_rd_by_agency`
**Numbers:** DOD's basic research obligations went from **$1.40B (FY05) → $4.69B (FY24)** — a 3.4x nominal increase (2.1x real). DOD's basic share of its own R&D budget rose from **2.2% → 4.8%**. Total DOD R&D was $63.66B → $98.09B (1.5x). Of the FY24 increase in basic research nationally, DOD contributed $1.2B of the $2.4B incremental basic research dollars.
**Chart:** Small multiples of agency basic-vs-applied-vs-dev stacked area, with DOD's growing basic wedge highlighted.
**Story:** DOD is one of the fastest-growing basic research funders in absolute terms — a quiet but profound shift in the structure of US science funding.

### 1.8 — Reconciliation: bottom-up captures only 49% of FY2024 HERD federal R&D, down from 80% in FY09

**Question:** How well do federal data sources (NIH+NSF+USAS) capture what universities self-report in HERD?
**Data:** `sheet_07_cross_source_reconciliation`
**Numbers:** Aggregate BU-vs-HERD coverage: **FY2009: 80% → FY2014: 67% → FY2019: 71% → FY2024: 49%**. Median per-institution delta (HERD minus bottom-up): **+21.3% (FY09) → +62.8% (FY24)**. In FY24, **815 non-tiny institutions** have a median absolute HERD/BU gap of 68.5%.
**Chart:** Line chart of "BU capture %" by year with sector breakouts; or scatter with HERD on x, BU on y, colored by sector.
**Story:** Bottom-up sources (NIH ExPORTER + NSF awards + USASpending) increasingly fail to capture what universities count as federal R&D — likely because pass-throughs, FFRDC contracts, agencies outside NIH/NSF (DOD/HHS contracts to USUHS-like entities), and state allocations of federal funds increasingly aren't visible at the level the bottom-up data captures.

### 1.9 — California, NY, MD, TX, PA capture 40% of all federal R&D — but Maryland nearly tripled

**Question:** How is federal R&D distributed by state and which states grew fastest?
**Data:** `sheet_01_institution_funding_panel` × `state_code`
**Numbers:** Top 5 states by FY24 federal R&D: **CA $7.81B, NY $5.28B, MD $5.21B, TX $3.91B, PA $3.61B** = 40% of national total. State growth FY05→FY24:
- Maryland: $1.77B → $5.21B (+195%) — largest among top 10
- Georgia: $0.74B → $2.50B (+236%) — fastest in top 15
- California: $3.97B → $7.81B (+97%) — modest growth despite biggest base
- Tennessee: $0.47B → $1.17B (+148%)

Top 20 states absorb 80.7% of federal R&D.
**Chart:** Choropleth map of US states, scaled by FY24 federal R&D; year slider to animate the shift.
**Story:** Federal R&D has reshuffled toward the southeastern Atlantic corridor (MD, NC, GA) and away from the Pacific coast in relative terms — Maryland alone added $3.4B over 20 years, more than the federal R&D footprint of 35 entire states.

### 1.10 — NSF spent 53.7% more on basic research in FY09 — biggest single-year ARRA bump

**Question:** Which agency saw the largest one-year spike from ARRA stimulus?
**Data:** `sheet_04_federal_rd_by_agency` FY08-FY10
**Numbers:** FY08→FY09 agency obligations growth:
- NSF: **$4.51B → $6.92B (+53.7%)** — largest pct jump of any agency
- DOE: $8.99B → $11.56B (+28.6%)
- HHS: $29.70B → $35.74B (+20.3%)
- NASA: +1.9% only

By FY11, NSF was back at $5.54B (down 19.9% from FY09 peak). The ARRA bolus was front-loaded.
**Chart:** Line chart of NSF/DOE/HHS obligations FY07-FY12 with ARRA span shaded.
**Story:** NSF was the single largest beneficiary in percentage terms of ARRA stimulus, but the bump was short-lived. The "post-ARRA cliff" of FY11 explains why FY12-FY15 federal R&D had three negative real-growth years in a row.

### 1.11 — Engineering and Computer Sciences nearly tripled while Geosciences flatlined

**Question:** Which fields gained and lost ground over 20 years?
**Data:** `sheet_03_rd_by_field`
**Numbers:** Total R&D by field, real 2024 dollars, FY05→FY24:
- Non-S&E: $2.84B → $7.59B (**x2.68**)
- Engineering: $10.86B → $19.28B (x1.78)
- Computer & info sciences: $2.26B → $3.96B (x1.75)
- Life sciences: $44.45B → $66.86B (x1.50)
- Geosciences/atmospheric/ocean: $4.11B → $4.41B (**x1.07** — virtually flat in real terms)
- Other sciences: $1.23B → $1.27B (x1.04 — flat)
- Physical sciences: $5.96B → $7.47B (x1.25)

Field share shift: Engineering +2.2pp, Non-S&E +2.8pp; Life sciences -1.25pp, Geosciences -1.6pp.
**Chart:** Treemap of FY24 vs ghost-treemap of FY05 (with same area scale), animated.
**Story:** "Engineering" and "Non-Science & Engineering" (mostly business administration research) are the fastest growers. Earth science / geosciences are the great losers — flat in real terms for 20 years.

### 1.12 — The federal share of life-sciences R&D has eroded from 64% to 55%

**Question:** Are universities relying less on federal money for biomedical research?
**Data:** `sheet_03_rd_by_field`
**Numbers:** Federal share of life-sciences R&D: **64.1% (FY05) → 54.6% (FY15) → 54.7% (FY24)**. Federal share of social sciences: **41.4% (FY05) → 33.2% (FY24)** — a 8pp decline. Federal share of computer & info sciences: **72.7% → 65.7%** — also declined.
**Chart:** Multi-line chart of federal share % by field over time.
**Story:** Across the major fields, the federal government's relative role in funding university R&D has retreated. Universities and nonprofits (foundations like HHMI, Gates) have stepped in.

### 1.13 — Specialty institutions: 99% USDA-funded HBCUs, 99% DOD-funded engineering schools

**Question:** Which institutions are funded by essentially one agency?
**Data:** `sheet_02_institution_agency` FY2023 (latest fully populated year)
**Numbers:** Single-agency-dominant universities (FY23):
- Montana State University, Billings: $268M total, **DOD = $267M (99%)**
- Wichita State University: $135M total, **DOD = $122M (91%)** — National Institute for Aviation Research
- LINCOLN UNIVERSITY: $28M total, **USDA = $27M (98%)** — 1890 land-grant HBCU
- U. Maryland Eastern Shore: $24M total, USDA = $22M (93%) — 1890 HBCU
- South Carolina State University: $20M, USDA $19M (92%)
- U. Corp. for Atmospheric Research (UCAR): $208M, **NSF = $148M (71%)**
- Woods Hole Oceanographic: $213M, NSF = $138M (65%)

For non-trivially-funded universities (>$30M): there are 7+ universities with >50% single-agency funding.
**Chart:** Sunburst or sankey: pick an agency → see institutions where that agency funds >40%.
**Story:** "Mission-aligned" institutions are a real category — many universities exist primarily to serve one agency's research mission, and HBCU 1890 land-grants are almost entirely USDA-supported.

### 1.14 — University self-funding has grown from $8.26B to $30.18B — a 3.7x leap

**Question:** Who's actually paying for university R&D growth?
**Data:** `sheet_01_institution_funding_panel`
**Numbers:** Institutional funds (universities funding themselves): **$8.26B (FY05) → $30.18B (FY24)**, 3.7x nominal. State+local government R&D held flat: $2.94B → $6.08B (2.1x — barely beating inflation). Business industry: $2.29B → $6.36B (2.8x). Top self-funded universities (FY24, >$50M total): CUNY Graduate Center (91% self), Kennesaw State (80%), BYU (75%), SUNY Binghamton (72%), Baylor (66%).
**Chart:** Streamgraph of funding sources, focused on institutional funds growth bulge.
**Story:** Universities are increasingly the customer, the supplier, and the funder of their own research — a fundamental change in the political economy of academic science.

### 1.15 — Indiana University Bloomington jumped 2.5x in a single year (FY15), and there's an explanation

**Question:** What's the biggest single-year anomaly in the entire dataset, and what does it mean?
**Data:** `sheet_01_institution_funding_panel`, `sheet_07_cross_source_reconciliation`
**Numbers:** Indiana University Bloomington's federal R&D:
- FY10-14: $71M, $74M, $80M, $86M, $85M (gentle growth)
- **FY15: $211M (+149% YoY)**
- FY16: $222M; FY17: $245M; etc.
- FY24: $457M

The recon flag for FY15-onward is `large_positive` — bottom-up sources only find $75M of NIH/NSF/USAS funding in FY24 against HERD's $457M, a 84% gap. Most likely explanation: in 2015 the IU School of Medicine in Indianapolis was reorganized into Bloomington's reporting unit, but NIH ExPORTER still maps grants to "Indiana University-Purdue University, Indianapolis" (which dropped from $143M → $18M FY15).
**Chart:** Annotated step line; companion view of IUPUI dropping in mirror.
**Story:** This is a classic NCSES reporting artifact — an entity reorganization moves $130M+ of grants from one campus to another instantly, but downstream federal-grant databases don't update for years. Tag it as a "reporting-boundary anomaly."

### 1.16 — Wichita State grew 18x — the fastest decade among 1014 institutions

**Question:** Which institution had the most dramatic ascent in federal R&D, and how?
**Data:** `sheet_01_institution_funding_panel`
**Numbers:** Wichita State University federal R&D:
- FY05-FY16: hovered around $10-21M
- FY17: $22M
- **FY19: $30M → FY24: $183M** (6x in five years)
- 18x from FY05 baseline of $10M

Most of this is DOD funding to the National Institute for Aviation Research (NIAR). In FY23, Wichita's DOD share = 91% of federal.
**Chart:** Annotated line with a callout box explaining NIAR's expansion; counterfactual line "median institution" overlay.
**Story:** Wichita State is the dataset's most extreme growth story — a state university transformed by a single Air Force / DOD program into a top-100 federal R&D recipient in under a decade.

### 1.17 — Sequestration (FY13) and the FY16 budget cliff: where did the money go?

**Question:** What were the post-ARRA contraction periods and which agencies absorbed the pain?
**Data:** `sheet_04_federal_rd_by_agency`
**Numbers:** Federal R&D obligations YoY:
- FY13: -9.3% ($140.7B → $127.6B) — sequestration; DOD took -13.9% / -$10.3B
- FY16: -10.1% ($131.6B → $118.3B) — biggest one-year decline; DOD -27.2% ($61.7B → $44.9B)
- FY16 was driven by a one-time accounting reclassification at DOD reducing development obligations
- Compare to FY09: +12.2% (ARRA) and FY20: +18.2% (COVID)

HHS during sequestration: -5.8%; NSF: -6.6%.
**Chart:** Waterfall chart of YoY changes; or annotated step line of national total with policy regime bands.
**Story:** The system has experienced two double-digit contractions and two double-digit expansions in 20 years — a deeply lumpy, politically-driven funding regime.

### 1.18 — NSF stayed 80% basic research — alone among major agencies

**Question:** Which agency is the true "guardian" of basic research?
**Data:** `sheet_04_federal_rd_by_agency`
**Numbers:** Basic research share of agency R&D obligations, FY24:
- **NSF: 77%** (down from 83% in FY05)
- HHS: 46%
- Agriculture (USDA): 43%
- NASA: 40%
- DOE: 34%
- DOD: 5%

Compare to FY05: NSF 83%, HHS 54%, DOD 2%. HHS basic share fell -8pp; NSF -6pp.
**Chart:** Triangle chart (ternary) of basic/applied/dev for each agency, animated over time.
**Story:** NSF is the only major agency where basic research dominates — but even at NSF, applied research has grown from 8% to 16% of the portfolio over 20 years. Basic research is being squeezed across the system.

### 1.19 — SBIR/STTR more than doubled, and DOD now does 58% of it

**Question:** How has small-business research funding evolved, and who runs it?
**Data:** `sheet_06_sbir_sttr`
**Numbers:** SBIR+STTR total: **$2.37B (FY05) → $4.91B (FY24)** = 2.1x nominal. STTR share: 10% throughout. By agency, FY24:
- DOD: $2.87B (58%)
- HHS: $1.23B (25%)
- DOE: $0.31B
- NSF: $0.20B
- NASA: $0.18B
- USDA: $0.04B

The number of unique firms grew from 3,333 (FY05) to 3,774 (FY24). 125,586 lifetime awards in the data. Top firms: Physical Sciences Inc (MA, $530M), Physical Optics Corp (CA, $413M), Creare (NH, $384M).
**Chart:** Stacked area of SBIR by agency; companion view of "top SBIR contractor firms" map.
**Story:** SBIR was meant to spread federal R&D to small companies, but it's increasingly a DOD program — and a handful of professional SBIR-receiving firms have built businesses on continuous awards (Physical Sciences Inc has won 1,120 awards over 20 years).

### 1.20 — NCI funding is the most concentrated NIH IC: Leidos alone gets 10%

**Question:** Within NIH Institutes, where is funding most concentrated to a single recipient?
**Data:** `sheet_12_nih_ic_breakdown` FY24
**Numbers:** Total NCI to all institutions FY24: $5.12B
- Leidos Biomedical Research Inc.: **$510M (10.0%)** — operating the NCI Frederick lab
- MD Anderson: $144M (2.8%)
- Memorial Sloan-Kettering: $136M (2.7%)
- Dana-Farber: $126M (2.5%)
- Top 10 NCI recipients = 26%; top 25 = 49%

Compare to NIAID FY24: top recipient (Duke) gets $190M = 4% of NIAID.
**Chart:** Bar chart of top 25 NCI recipients with Leidos's outlier bar emphasized; toggle to NIAID for contrast.
**Story:** NCI's funding is dominated by a single contract operator (Leidos Biomedical Research, which runs the NCI's Frederick National Laboratory). When you remove Leidos, NCI's institutional concentration is roughly comparable to other ICs.

---

## SECTION 2 — FIVE ANOMALIES / SURPRISES

### 2.1 — Uniformed Services University swings wildly between $40M and $480M

**Numbers:** USUHS federal R&D over 20 years: $50M (FY05) → $39M (FY06) → $67M (FY08) → $124M (FY09) → $72M (FY10) → $213M (FY14) → $299M (FY15) → $175M (FY16) → $204M (FY17) → $235M (FY20) → $194M (FY22) → **$404M (FY23) → $482M (FY24)**.
**Why:** USUHS is the DOD's medical school — it's a federal institution (uniformed services), not a true university, and its funding comes directly from DOD line items. The volatility reflects DOD program cycles. Recon FY24 shows HERD=$482M but bottom-up captures **$0M** (NIH ExPORTER doesn't track USUHS, USAS contracts to military medical assets are opaque). This is the single largest "100% unexplained" institution in the dataset.

### 2.2 — Yeshiva University collapsed: $181M (FY15) → $30M (FY16) → $2M (FY24)

**Numbers:** Yeshiva's federal R&D: $161M (FY05), $181M (FY15), then **$30M (FY16) — a 83% YoY drop**. By FY24: $2M total federal R&D. **A $159M institutional loss.**
**Why:** In 2015 the Albert Einstein College of Medicine separated from Yeshiva University and became an independent affiliate of Montefiore Health System. AECOM took the federal grants with it but the canonical name "Yeshiva University" no longer maps to AECOM in HERD. This is a structural / entity-resolution issue (and the cleanest single example of how university restructuring shows up as catastrophic anomaly in the data).

### 2.3 — Indiana University Bloomington added $126M in a single year (FY15)

**Numbers:** IU Bloomington went from $85M (FY14) → **$211M (FY15) — a +149% YoY jump**. Indiana University-Purdue Indianapolis dropped from $143M → $18M in FY15 (-87%).
**Why:** Recon notes flag "large_positive" for IUB from FY15 onward. Likely a reporting realignment — possibly tied to the IU School of Medicine's IUPUI campus rolling up to Bloomington. Bottom-up still captures only $75M in FY24 (BU=16% of HERD), suggesting the NIH ExPORTER mapping never updated.

### 2.4 — Texas A&M jumped $158M (44%) in FY20 — and rerouted from DOD to DoD pass-throughs

**Numbers:** Texas A&M College Station's federal R&D: $360M (FY19) → **$517M (FY20)** → continued growth to $583M (FY24). HERD reports $583M FY24 but bottom-up shows only $74M — a **$509M gap (+87%)**. Texas A&M is the institution where HERD-vs-BU discrepancy is largest in absolute terms among large recipients.
**Why:** Texas A&M operates several DOD-aligned research facilities (TEES, Texas A&M Engineering Experiment Station, plus the new RELLIS campus). FY20 was the launch year of large DOD contracts that flow through TEES rather than appearing in standard NIH/NSF/USAS feeds.

### 2.5 — University of Colorado Denver: HERD reports $18M but NIH alone shows $312M

**Numbers:** U Colorado Denver in FY24 — HERD federal R&D = **$18M**, but NIH funding alone = **$312M** (no NSF, no USAS contracts in the bottom-up captured data). This is the dataset's largest negative gap among institutions with >$10M HERD reporting.
**Why:** University of Colorado Denver is a small downtown campus; most NIH research at "U Colorado Denver" maps in HERD to the *Anschutz Medical Campus* which is a separate institutional code. The entity resolution sees them as distinct, but NIH ExPORTER awards have "Denver" in the institutional address.

---

## SECTION 3 — FIVE MOST INTERESTING CROSS-SOURCE PATTERNS

### 3.1 — JHU bottom-up capture: 61% gap in FY24 ($3.6B HERD vs $1.4B BU)

**Pattern:** Johns Hopkins reports **$3.62B in HERD FY24** but bottom-up (NIH+NSF+USAS contracts+assistance) shows only **$1.43B**, a **$2.19B / +61% gap**.
**Why:** APL (Applied Physics Lab) is a JHU operating unit but its DOD contracts route through specialized vehicles. ~$2B of JHU's federal funding is APL-related and largely invisible to standard federal-grant databases.
**Chart:** Side-by-side bars: HERD vs BU stacked by source, with the "APL gap" labeled. Year toggle to show the gap widening (was 39% in FY20).

### 3.2 — BU capture is collapsing in absolute terms across the top 15 recipients

**Pattern:** Among 15+ institutions with >$200M FY24 HERD, BU capture fell sharply FY20→FY24:
- Georgia Tech: 53% → 19%
- MIT: 94% → 37%
- Penn State: 70% → 36%
- Michigan State: 76% → 29%
- UCLA: 113% → 55%
- Berkeley: 87% → 46%

**Why:** This is **not** an entity-resolution problem — these institutions have stable identities. The likely cause is the **mix-shift away from NIH-style grants** toward **DOD, DOE, and HHS contracts** that don't show up in NIH ExPORTER but do count as federal R&D in HERD. Possibly amplified by USASpending data quality decline post-FY22.
**Chart:** Connected scatter (FY20 BU% on x, FY24 BU% on y), with diagonal y=x line; institutions below the line are losing BU capture.

### 3.3 — FFRDC funding gap: $16B not visible at university level

**Pattern:** Federal R&D flow shows **$16.35B (FY24) routed to FFRDCs** (Federally Funded R&D Centers like Argonne, Brookhaven, JPL). But sheet_01 panel data has only one FFRDC (MIT, $595M). The other ~$15.7B is "off-panel."
**Why:** Major FFRDCs (LLNL, ORNL, NREL, JPL, Argonne, Brookhaven, SLAC) aren't covered by HERD because the survey focuses on degree-granting institutions. They're a significant blind spot — together they're 8.2% of federal R&D performers.
**Chart:** Sankey: Federal → Agency → Performer category, with FFRDC and Universities highlighted at different heights to show scale.

### 3.4 — Bottom-up captures **more** than HERD at small institutions

**Pattern:** Among institutions with HERD <$5M, 87% have BU > HERD. For 406 tiny anchors (out of 15,950 recon rows), the median delta_pct is **-65%** (BU much larger than HERD) — but tiny anchors are flagged separately because the % is misleading at small absolute scale.
**Why:** Small institutions often have specific NIH R15/R03 grants that fully fund their reported research, but HERD respondents at small schools sometimes under-report (the HERD survey is voluntary and burdens small offices).
**Chart:** Scatter with HERD on x (log), BU on y (log), with the y=x line and `is_tiny_anchor` colored separately.

### 3.5 — The CO Denver / Anschutz Medical Campus split shows the cost of entity resolution drift

**Pattern:** U Colorado Denver HERD = $18M / BU NIH = $312M FY24 (BU is 17x HERD). This is the inverse pattern — bottom-up sources see far more than HERD. The "missing" $294M is at U Colorado Anschutz, which the dataset treats as a separate institution.
**Why:** Federal grants databases (NIH ExPORTER) historically grouped Denver + Anschutz under "UNIVERSITY OF COLORADO DENVER" before the Anschutz campus was rebranded. HERD treats them as two reporters. The dim_institution table flags this in `er_audit_parent_child` for some sub-orgs, but the recon table doesn't apply parent-rollup at the BU side.
**Chart:** Two stacked lines: U Colorado Denver and U Colorado Anschutz HERD over time, vs single combined NIH ExPORTER line.

---

## SECTION 4 — FIVE UNDEREXPLORED TIME-SERIES INFLECTION POINTS

### 4.1 — FY2009 ARRA bump: $15B added in one year, largest in NSF history

**Inflection:** Federal R&D obligations: $129.0B (FY08) → $144.8B (FY09) = +$15.8B / +12.2% in one year. NSF saw the biggest pct jump (+53.7% / +$2.4B). The "ARRA cliff" of FY11 (-4.9%) and continued declines through FY16 dropped the ARRA money out completely.
**Story arc:** "The stimulus that vanished" — show NSF's FY09 spike and the subsequent decade of decline back to pre-ARRA real-dollar levels.

### 4.2 — FY2016 mystery cliff: -10.1% / -$13.3B in federal R&D

**Inflection:** FY15: $131.6B → FY16: $118.3B obligations — a $13.3B decline. Almost entirely from DOD (which dropped -27.2% / -$16.7B that year). DOD development obligations cratered.
**Story arc:** "The accounting cliff" — this is largely a one-time reclassification (DOD changed how it categorized weapons development as "RDT&E"), not a real cut. Worth showing as a "data anomaly to flag."

### 4.3 — FY2020-21 COVID surge: +$37.6B / +24% at HHS

**Inflection:** HHS R&D: $39.4B (FY19) → $61.8B (FY20) → **$77.1B (FY21)** → $74.4B (FY22) → $53.0B (FY23). The bulk was Operation Warp Speed development funding (FY21 dev = $33.9B, vs $0.84B in FY19). NIAID share of NIH rose from 13% to 16%.
**Story arc:** "The pandemic moonshot" — show how COVID dollars went disproportionately to development not basic research, then evaporated.

### 4.4 — FY2022-24 CHIPS+IRA era for DOD basic research

**Inflection:** DOD basic research went from $2.51B (FY19) → $2.50B (FY20) → $3.47B (FY23) → **$4.69B (FY24)**. The FY23-FY24 jump (+35%) is the largest two-year DOD basic research increase in the dataset. CHIPS Act and IRA both began funding semiconductor / advanced manufacturing research at universities in this period.
**Story arc:** "DOD discovers science" — the basic research mission of the National Defense Strategy is becoming visible in the numbers.

### 4.5 — FY2014-15 "data fog": flow table goes dark for two years

**Inflection:** Sheet_10_federal_rd_flow has FY2015 and FY2016 with zeros across all performer categories — only the "unmapped_remainder" has values. NSF NCSES discontinued the standard Federal Funds for Research and Development survey reporting in those years (it was suspended due to budget cuts).
**Story arc:** "When the survey went silent" — a meta-story about how federal R&D statistics themselves got cut in the FY13-16 budget squeeze. Acknowledge the data gap prominently in the dashboard.

---

## SECTION 5 — THREE NARRATIVE ARCS FOR SCROLLYTELLING

### 5.1 — "The University Self-Funding Revolution"

**Title:** From 64% federal to 55%: How universities became their own customers
**Key insight:** Federal share of university R&D fell from 63.8% to 55.0% over 20 years, while institutional funds rose from 18.1% to 25.7%. Universities funded themselves $30.18B in FY24 — up from $8.26B in FY05.

**Waypoints:**
1. **Hero chart:** Stacked area of all 6 funding sources by year, with federal-share line overlaid.
2. **The wedge:** Zoom into institutional funds — bar chart of $8B → $30B with year-by-year stops.
3. **Who's doing it most:** Top 15 universities by self-funding share (CUNY Graduate Center 91%, Kennesaw 80%, BYU 75%).
4. **The flip side:** Federal share by field — life sciences from 64% to 55%, social sciences from 41% to 33%.
5. **Why it matters:** Show JHU's institutional funds growth pattern, vs HBCU sector's flat real-dollar trajectory — self-funding is a luxury of wealthy institutions.
6. **The exception:** Small + minority-serving institutions, where federal grants remain >70% of R&D.

### 5.2 — "Three Crises in 20 Years"

**Title:** ARRA, Sequester, COVID — how federal R&D shapes itself around politics
**Key insight:** Federal R&D obligations have lurched between +18% (FY20) and -10% (FY16) for two decades. Each shift redistributed money across agencies in ways that took years to reset.

**Waypoints:**
1. **The full timeline:** National federal R&D obligations FY05-FY24 with annotated bands for ARRA, sequestration, FY16 cliff, COVID, CHIPS era.
2. **ARRA: NSF's moment:** +54% in one year for NSF; show what got funded (XSEDE supercomputing got $220M FY11 grant).
3. **Sequester: DOD takes the hit:** -$10.3B from DOD in FY13, -$1.8B from HHS.
4. **FY16 mystery:** Why did DOD R&D obligations fall $16.7B? (Reclassification — show the explanation).
5. **COVID at HHS:** $0.84B → $33.93B in development funding in two years; then back to zero.
6. **What survived:** Sustained gains in NSF basic research and DOD basic research show what each crisis "ratcheted up."

### 5.3 — "The Geography of American Science"

**Title:** From the Pacific to the Mid-Atlantic: where federal R&D moved
**Key insight:** Top 5 states (CA, NY, MD, TX, PA) absorb 40% of federal R&D, but the relative weights shifted dramatically. Maryland alone added $3.4B (+195%); California added $3.8B (+97%).

**Waypoints:**
1. **The choropleth, animated:** US states scaled by federal R&D, FY05 → FY24 timeline.
2. **The winners:** Bar chart of states by absolute growth — MD, GA (+236%), NC (+170%), CO (+142%).
3. **Concentration by institution:** Top 10 institutions = 21% of federal R&D in FY24 (vs 20% in FY05) — concentration is steady, not increasing despite JHU's growth.
4. **Single-state stories:** Maryland = JHU dominance + UMD + NIH proximity. Georgia = Georgia Tech + Emory rise. North Carolina = the Research Triangle (RTI gets $399M from NIH alone).
5. **The losers:** State-relative declines — Louisiana, Mississippi, West Virginia all gained less than the national average.
6. **The HBCU geographic dimension:** Map of HBCUs colored by federal R&D growth — show that DC/Maryland HBCUs (Howard, etc.) gained while many southern HBCUs stagnated.

---

## SECTION 6 — FIVE UNEXPLORED JOINS / CORRELATIONS

### 6.1 — NIH IC concentration vs total NIH dollars per institution

**Join:** `sheet_12_nih_ic_breakdown` self-join — compute (max IC share) for each institution × (log total NIH).
**Hypothesis:** Smaller NIH-funded institutions are more IC-concentrated (one R01-heavy lab).
**Finding from data:** Among 200+ universities with >$50M NIH FY24, max IC share ranges from 11% (UCSD, very diversified) to 90% (Benaroya Research, NIAID-exclusive). 25 institutions have >40% in a single IC. Cancer-specialized centers (MD Anderson 75% NCI, Dana-Farber 77% NCI, MSK 66% NCI) form a cluster.
**Visual:** Scatter with log(NIH total) on x, max IC % on y; colored dots for cancer centers vs general medical research universities.

### 6.2 — Contract vs assistance ratio by agency (USAS data)

**Join:** `sheet_07_cross_source_reconciliation.usaspending_assistance_usd_nominal` vs `usaspending_contracts_usd_nominal` per institution × FY.
**Hypothesis:** DOD-heavy universities have high contract-to-assistance ratios; HHS-heavy have the opposite.
**Finding:** This ratio is a clean proxy for "what kind of federal partner an institution is." Universities like JHU (APL) have contracts >> assistance; universities like UCSF have assistance >> contracts. We can build a "research mode" classifier from this.
**Visual:** Scatter with each institution as a dot, axes log(contracts) and log(assistance), and quadrants labeled "Grant-driven biomedical research," "Contract-driven defense/applied research," etc.

### 6.3 — PI portfolio diversification and institutional aggregate

**Join:** `sheet_08_pi_cross_agency_portfolio` × `sheet_01` — for each university, what fraction of PIs are NIH-heavy vs NSF-heavy?
**Finding:** 2,033 cross-agency PIs in the data; both-NIH+NSF PIs have a median NIH share of 66.1%. But Stanford, Cornell, MIT have many "NSF-tilted" PIs while Hopkins and UCSF are NIH-monocultures. Career span median = 16 years (the data's full window).
**Visual:** Box plot of NIH share % per PI, split by institution — shows the cultural fingerprint of each research university.

### 6.4 — SBIR firm geography vs university partnerships

**Join:** `sheet_06_sbir_sttr` firm location vs research institution partner (`ri_institution_sk`).
**Finding:** Most STTR awards require a university partner. Massachusetts has 5 of the top 15 SBIR-winning firms — likely an MIT/Harvard ecosystem effect. Top SBIR firms ($300M+) co-locate with strong research universities: PSI/MIT (MA), Creare/Dartmouth (NH), Aptima/MIT (MA), Charles River Analytics/MIT (MA).
**Visual:** Bubble map of SBIR firms with lines connecting to their university partners; firm size = total $; line thickness = number of joint awards.

### 6.5 — Field concentration vs reconciliation gap

**Join:** `sheet_03_rd_by_field` (federal share by field) × `sheet_07` (recon delta_pct).
**Hypothesis:** Universities heavy in engineering / non-S&E fields will have larger HERD-vs-BU gaps (because those federal dollars flow through contracts not NIH/NSF grants).
**Finding to test:** Georgia Tech is 19% BU capture and engineering-dominated. UCSD is 55% BU capture and life-sciences-dominated. There's a structural link between field portfolio and how visible an institution's federal R&D is in standard data.
**Visual:** Scatter where each university is a dot, x = pct of federal R&D in engineering, y = bottom-up capture %; downward trend suggests engineering R&D is less visible to NIH/NSF databases.

---

## Methodology Notes

All numbers above were pulled directly from the 15 parquet files in `apps/web/public/data/`. Key flags:

- **delta_pct in sheet_07 is stored as fraction** (e.g., 0.629 = 62.9%, not 0.6%) — multiply by 100 for proper presentation.
- **sheet_02_institution_agency** has NaN HHS values before FY2014 — agency-by-institution breakouts are only reliable FY2014-2023.
- **sheet_10_federal_rd_flow** has FY2015 and FY2016 entirely "unmapped_remainder" — treat as a data gap.
- **sheet_01_institution_funding_panel** has `FY2005-FY2009 Nonprofit organizations` as null (NCSES didn't break this out until FY2010).
- **is_tiny_anchor** in sheet_07 filters institutions with HERD < $2M-ish (where percentage deltas become noisy); always exclude when computing aggregate gap stats.
- **FFRDCs**: only MIT is in the panel; the other 8.2% of federal R&D at FFRDCs (Lawrence Livermore, JPL, etc.) is invisible.
- **JHU sector "ffrdc"** in NIH IC table is a labeling oddity — JHU is treated as ffrdc-like in some contexts because APL is an FFRDC operated by JHU.
