/** Synthetic intake documents. All employers, carriers and figures are fictional. */
export interface Sample {
  id: string;
  title: string;
  description: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "clean-ppo",
    title: "Clean PPO summary",
    description: "Well-formed carrier summary; should extract fully with no errors.",
    text: `BENEFITS IMPLEMENTATION INTAKE — MEDICAL
Employer: Northwind Traders LLC
Carrier: Blue Harbor Health
Plan Name: Harbor Choice PPO 1500
Plan Type: PPO
Effective Date: 01/01/2025
Renewal Date: 12/31/2025

COST SHARING (IN-NETWORK)
Deductible — Individual: $1,500
Deductible — Family: $3,000
Out-of-Pocket Maximum — Individual: $5,000
Out-of-Pocket Maximum — Family: $10,000
Coinsurance (member pays): 20%
Primary Care Visit copay: $25
Specialist Visit copay: $50
Emergency Room copay: $250

ELIGIBILITY
Eligible class: full-time employees working 30 hours per week
Waiting period: 30 days
Employer contribution: 80% of employee-only premium
HSA eligible: No`,
  },
  {
    id: "messy-hdhp",
    title: "Messy HDHP intake form",
    description: "Broker email + form fragments; swapped family/individual values and an HDHP below minimum.",
    text: `Hi team, attached is what we got from the client. Please load ASAP.

Group: Contoso Manufacturing
Insurer: Summit Mutual
Plan: Summit Saver HDHP
plan type: high deductible health plan
Coverage begins Feb 1, 2025

Ded: individual $1,200 / family $2,400
Deductible family: $2,400
Deductible individual: $1,200
Out of pocket max individual $3,000
Out of pocket max family $2,500
Coinsurance: 30%
PCP $0 after deductible
Specialist $0 after deductible

Eligibility: 32 hours/week
Waiting period: first of the month following 60 days
Company pays 75% EE premium
HSA eligible: Yes`,
  },
  {
    id: "conflicting-values",
    title: "Conflicting values across pages",
    description: "Two pages disagree on the deductible and the ER copay; contribution is missing.",
    text: `Page 1 of 2 — Plan Summary
Employer: Fabrikam Logistics
Carrier: Evergreen Health Plans
Plan Name: Evergreen Select HMO
Plan Type: HMO
Effective Date: 2025-07-01
Renewal Date: 2026-06-30
Deductible (individual): $500
Deductible (family): $1,000
Out-of-pocket max (individual): $4,000
Out-of-pocket max (family): $8,000
Coinsurance: 10%
Emergency Room: $300 copay

Page 2 of 2 — Rate Sheet Notes
Deductible (individual): $750
Deductible (family): $1,500
Emergency room copay $150
Specialist copay $40
Primary care copay $20
Waiting period: 90 days
Eligibility: 30 hours per week`,
  },
  {
    id: "sparse-email",
    title: "Sparse email",
    description: "Very little structured data; most required fields missing.",
    text: `From: broker@example.com
Subject: New group — Tailspin Toys

Hey, Tailspin wants to start coverage 3/1/2025 with Blue Harbor Health.
They're thinking the Harbor Choice PPO 1500 plan again. Same contribution as last year (70%).
Will send the SBC when I have it.`,
  },
];
