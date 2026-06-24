"""Generate 3 synthetic datasets with clear causal signal for the rootLens platform.

Outputs (relative to repo root):
  data/samples/customer_churn.csv          - binary classification (churned)
  data/samples/manufacturing_defects.csv   - regression            (defect_rate_percent)
  data/samples/loan_default.csv            - binary classification (defaulted)

Run:
    python backend/scripts/generate_sample_datasets.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = REPO_ROOT / "data" / "samples"
OUT_DIR.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(42)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _bernoulli(p: np.ndarray) -> np.ndarray:
    return (RNG.random(len(p)) < p).astype(int)


def _inject_missing(s: pd.Series, rate: float) -> pd.Series:
    mask = RNG.random(len(s)) < rate
    s = s.copy()
    s[mask] = np.nan
    return s


def make_customer_churn(n: int = 3000) -> pd.DataFrame:
    """Telecom-style churn. Target: churned (0/1).

    Strong drivers:
      - short tenure_months                -> churn up
      - contract_type = 'month-to-month'   -> churn up
      - many support_tickets_90d           -> churn up
      - no tech_support / no online_security -> churn up
      - high monthly_charges               -> churn up (mild)
    """
    tenure_months = RNG.integers(1, 72, size=n)
    monthly_charges = np.round(RNG.normal(70, 25, n).clip(20, 160), 2)
    total_charges = np.round(monthly_charges * tenure_months * RNG.uniform(0.85, 1.05, n), 2)

    contract_type = RNG.choice(
        ["month-to-month", "one-year", "two-year"], size=n, p=[0.55, 0.25, 0.20]
    )
    payment_method = RNG.choice(
        ["electronic-check", "mailed-check", "bank-transfer", "credit-card"],
        size=n,
        p=[0.35, 0.15, 0.25, 0.25],
    )
    internet_service = RNG.choice(["DSL", "Fiber", "None"], size=n, p=[0.35, 0.50, 0.15])
    online_security = RNG.choice(["yes", "no"], size=n, p=[0.35, 0.65])
    tech_support = RNG.choice(["yes", "no"], size=n, p=[0.40, 0.60])
    is_senior_citizen = RNG.choice([0, 1], size=n, p=[0.82, 0.18])
    avg_monthly_usage_gb = np.round(RNG.gamma(3.0, 25.0, n).clip(1, 500), 1)
    support_tickets_90d = RNG.poisson(lam=1.5, size=n)

    contract_effect = np.where(contract_type == "month-to-month", 1.6,
                      np.where(contract_type == "one-year", -0.2, -1.6))
    internet_effect = np.where(internet_service == "Fiber", 0.5,
                      np.where(internet_service == "DSL", 0.0, -0.4))
    payment_effect = np.where(payment_method == "electronic-check", 0.6, -0.1)

    logit = (
        -1.2
        + -0.045 * tenure_months
        + 0.012 * (monthly_charges - 70)
        + 0.30 * support_tickets_90d
        + contract_effect
        + internet_effect
        + payment_effect
        + np.where(tech_support == "no", 0.55, -0.25)
        + np.where(online_security == "no", 0.45, -0.20)
        + 0.35 * is_senior_citizen
        + RNG.normal(0, 0.4, n)
    )
    churned = _bernoulli(_sigmoid(logit))

    df = pd.DataFrame(
        {
            "customer_id": [f"CUST{i:06d}" for i in range(n)],
            "tenure_months": tenure_months,
            "monthly_charges": monthly_charges,
            "total_charges": total_charges,
            "contract_type": contract_type,
            "payment_method": payment_method,
            "internet_service": internet_service,
            "online_security": online_security,
            "tech_support": tech_support,
            "is_senior_citizen": is_senior_citizen,
            "avg_monthly_usage_gb": avg_monthly_usage_gb,
            "support_tickets_90d": support_tickets_90d,
            "churned": churned,
        }
    )
    df["avg_monthly_usage_gb"] = _inject_missing(df["avg_monthly_usage_gb"], 0.03)
    df["total_charges"] = _inject_missing(df["total_charges"], 0.01)
    return df


def make_manufacturing_defects(n: int = 2500) -> pd.DataFrame:
    """Factory batches. Target: defect_rate_percent (regression, 0-20+).

    Strong drivers:
      - raw_material_grade C               -> defects up
      - large maintenance_days_ago         -> defects up
      - extreme temperature_c (away from 22)-> defects up
      - night shift                        -> defects up
      - older machine_age_months           -> defects up
      - lower operator_experience_years    -> defects up
    """
    machine_id = RNG.choice([f"M{i:02d}" for i in range(1, 13)], size=n)
    shift = RNG.choice(["morning", "afternoon", "night"], size=n, p=[0.4, 0.35, 0.25])
    operator_experience_years = np.round(RNG.gamma(2.0, 2.5, n).clip(0.1, 25), 1)
    temperature_c = np.round(RNG.normal(22, 5, n), 1)
    pressure_psi = np.round(RNG.normal(100, 12, n).clip(60, 150), 1)
    humidity_percent = np.round(RNG.normal(45, 10, n).clip(10, 90), 1)
    raw_material_grade = RNG.choice(["A", "B", "C"], size=n, p=[0.45, 0.35, 0.20])
    machine_age_months = RNG.integers(1, 180, size=n)
    maintenance_days_ago = RNG.integers(0, 120, size=n)
    batch_size = RNG.integers(50, 1000, size=n)

    material_effect = np.where(raw_material_grade == "A", -1.2,
                      np.where(raw_material_grade == "B", 0.0, 2.8))
    shift_effect = np.where(shift == "night", 1.6,
                   np.where(shift == "afternoon", 0.4, 0.0))
    temp_effect = 0.18 * np.abs(temperature_c - 22)

    base = (
        2.0
        + material_effect
        + shift_effect
        + temp_effect
        + 0.025 * maintenance_days_ago
        + 0.015 * machine_age_months
        - 0.10 * operator_experience_years
        + 0.010 * (pressure_psi - 100)
        + RNG.normal(0, 1.0, n)
    )
    defect_rate_percent = np.round(np.clip(base, 0.0, 35.0), 2)

    df = pd.DataFrame(
        {
            "batch_id": [f"B{i:06d}" for i in range(n)],
            "machine_id": machine_id,
            "shift": shift,
            "operator_experience_years": operator_experience_years,
            "temperature_c": temperature_c,
            "pressure_psi": pressure_psi,
            "humidity_percent": humidity_percent,
            "raw_material_grade": raw_material_grade,
            "machine_age_months": machine_age_months,
            "maintenance_days_ago": maintenance_days_ago,
            "batch_size": batch_size,
            "defect_rate_percent": defect_rate_percent,
        }
    )
    df["humidity_percent"] = _inject_missing(df["humidity_percent"], 0.02)
    df["pressure_psi"] = _inject_missing(df["pressure_psi"], 0.02)
    return df


def make_loan_default(n: int = 4000) -> pd.DataFrame:
    """Consumer lending. Target: defaulted (0/1).

    Strong drivers:
      - low credit_score          -> default up
      - high debt_to_income_ratio -> default up
      - short employment_years    -> default up
      - high loan_to_income ratio -> default up
      - home_ownership = 'rent'   -> default up (mild)
      - purpose 'small-business'  -> default up
    """
    age = RNG.integers(21, 70, size=n)
    income_annual = np.round(RNG.lognormal(mean=10.9, sigma=0.45, size=n).clip(15000, 400000), 0)
    employment_years = np.round(RNG.gamma(2.0, 2.5, n).clip(0.0, 40), 1)
    loan_amount = np.round(RNG.uniform(2000, 60000, n), 0)
    loan_term_months = RNG.choice([12, 24, 36, 48, 60], size=n, p=[0.1, 0.2, 0.35, 0.2, 0.15])
    credit_score = RNG.normal(690, 70, n).clip(300, 850).astype(int)
    debt_to_income_ratio = np.round(RNG.beta(2, 5, n) * 0.9, 3)  # 0..0.9
    home_ownership = RNG.choice(["own", "rent", "mortgage"], size=n, p=[0.2, 0.45, 0.35])
    loan_purpose = RNG.choice(
        ["debt-consolidation", "credit-card", "home-improvement", "small-business", "car", "other"],
        size=n,
        p=[0.35, 0.20, 0.15, 0.08, 0.12, 0.10],
    )
    num_prior_loans = RNG.poisson(1.2, n)
    has_collateral = RNG.choice([0, 1], size=n, p=[0.75, 0.25])
    education_level = RNG.choice(
        ["high-school", "bachelor", "master", "phd"], size=n, p=[0.35, 0.45, 0.15, 0.05]
    )

    loan_to_income = loan_amount / np.maximum(income_annual, 1.0)

    home_effect = np.where(home_ownership == "rent", 0.40,
                   np.where(home_ownership == "mortgage", -0.10, -0.25))
    purpose_effect = np.where(loan_purpose == "small-business", 0.80,
                      np.where(loan_purpose == "debt-consolidation", 0.25, 0.0))

    logit = (
        -2.8
        + -0.010 * (credit_score - 690)
        + 3.2 * debt_to_income_ratio
        + -0.06 * employment_years
        + 1.2 * loan_to_income
        + home_effect
        + purpose_effect
        + -0.8 * has_collateral
        + RNG.normal(0, 0.4, n)
    )
    defaulted = _bernoulli(_sigmoid(logit))

    df = pd.DataFrame(
        {
            "loan_id": [f"L{i:07d}" for i in range(n)],
            "age": age,
            "income_annual": income_annual,
            "employment_years": employment_years,
            "loan_amount": loan_amount,
            "loan_term_months": loan_term_months,
            "credit_score": credit_score,
            "debt_to_income_ratio": debt_to_income_ratio,
            "home_ownership": home_ownership,
            "loan_purpose": loan_purpose,
            "num_prior_loans": num_prior_loans,
            "has_collateral": has_collateral,
            "education_level": education_level,
            "defaulted": defaulted,
        }
    )
    df["employment_years"] = _inject_missing(df["employment_years"], 0.02)
    df["debt_to_income_ratio"] = _inject_missing(df["debt_to_income_ratio"], 0.02)
    return df


def make_equipment_failure(n: int = 5000) -> pd.DataFrame:
    """Industrial rotating-equipment predictive maintenance.

    Represents a snapshot-per-asset-per-day record joining SCADA/Historian
    process tags with CMMS work-order data. Target: failure_within_30d (0/1).

    Attributes & units follow common plant conventions:
      - vibration_rms_mm_s        (ISO 10816 velocity severity; A<2.8, D>7.1)
      - oil_particle_count_iso4406 (ISO 4406 cleanliness code sum e.g. 18/16/13)
      - bearing_temp_c, motor_winding_temp_c, oil_temp_c
      - discharge_pressure_bar, suction_pressure_bar, flow_rate_m3_h
      - current_draw_amps, power_factor, load_percent
      - operating_hours, runtime_since_overhaul_hours, num_starts_30d
      - last_maintenance_days_ago, maintenance_type_last
      - asset_type (motor/pump/compressor), plant_site, criticality (A/B/C)

    Strong drivers of failure (what the rootLens should surface):
      - high vibration_rms_mm_s                (dominant)
      - high bearing_temp_c / motor_winding_temp_c
      - high oil_particle_count_iso4406        (contamination)
      - long runtime_since_overhaul_hours
      - long last_maintenance_days_ago
      - asset_type = compressor > pump > motor
      - high num_starts_30d                    (thermal cycling)
    """
    asset_type = RNG.choice(
        ["motor", "pump", "compressor"], size=n, p=[0.45, 0.35, 0.20]
    )
    plant_site = RNG.choice(
        ["HOU-01", "ROT-02", "JUB-03", "SIN-04", "ANT-05"], size=n,
        p=[0.28, 0.22, 0.20, 0.18, 0.12],
    )
    criticality = RNG.choice(["A", "B", "C"], size=n, p=[0.25, 0.50, 0.25])
    manufacturer = RNG.choice(
        ["Siemens", "ABB", "WEG", "Atlas-Copco", "Sulzer", "Flowserve", "KSB"],
        size=n,
    )

    rated_power_kw = np.round(RNG.choice([11, 22, 45, 75, 110, 160, 250, 400, 630], size=n), 0)
    rated_rpm = RNG.choice([1500, 1800, 3000, 3600], size=n, p=[0.35, 0.15, 0.35, 0.15])

    operating_hours = RNG.integers(1000, 85000, size=n)
    runtime_since_overhaul_hours = (
        operating_hours * RNG.uniform(0.1, 1.0, n)
    ).astype(int)
    last_maintenance_days_ago = RNG.integers(0, 540, size=n)
    maintenance_type_last = RNG.choice(
        ["preventive", "predictive", "corrective", "none"],
        size=n, p=[0.45, 0.20, 0.25, 0.10],
    )
    num_starts_30d = RNG.poisson(lam=np.where(asset_type == "compressor", 45, 12), size=n)

    # Process/condition-monitoring readings
    load_percent = np.round(RNG.normal(75, 12, n).clip(20, 110), 1)
    ambient_temp_c = np.round(RNG.normal(28, 6, n).clip(5, 50), 1)
    humidity_percent = np.round(RNG.normal(55, 15, n).clip(10, 95), 1)

    base_vib = np.where(asset_type == "compressor", 3.2,
               np.where(asset_type == "pump", 2.4, 1.8))
    vibration_rms_mm_s = np.round(
        (base_vib
         + 0.00004 * runtime_since_overhaul_hours
         + 0.003 * last_maintenance_days_ago
         + RNG.normal(0, 0.7, n)
         ).clip(0.3, 20.0),
        2,
    )
    vibration_peak_g = np.round((vibration_rms_mm_s * 0.28 + RNG.normal(0, 0.15, n)).clip(0.1, 10), 2)

    bearing_temp_c = np.round(
        (ambient_temp_c + 30
         + 0.15 * (load_percent - 75)
         + 1.8 * (vibration_rms_mm_s - base_vib)
         + RNG.normal(0, 3.0, n)
         ).clip(20, 130),
        1,
    )
    motor_winding_temp_c = np.round(
        (bearing_temp_c + 10 + 0.25 * (load_percent - 75) + RNG.normal(0, 4, n)).clip(25, 170),
        1,
    )
    oil_temp_c = np.round((bearing_temp_c - 5 + RNG.normal(0, 3, n)).clip(20, 120), 1)

    oil_pressure_bar = np.round(RNG.normal(3.5, 0.6, n).clip(0.5, 6.0), 2)
    # ISO 4406 code: three numbers summed as proxy e.g. 18/16/13 -> 47. Higher = dirtier.
    oil_particle_count_iso4406 = (
        RNG.integers(30, 55, size=n)
        + (runtime_since_overhaul_hours // 5000)
    ).clip(25, 70)

    suction_pressure_bar = np.round(RNG.normal(2.0, 0.4, n).clip(0.3, 5.0), 2)
    discharge_pressure_bar = np.round(
        suction_pressure_bar + RNG.normal(8, 2, n).clip(1, 25), 2
    )
    flow_rate_m3_h = np.round(
        (rated_power_kw * 0.6 + RNG.normal(0, 15, n)).clip(5, None), 1
    )
    current_draw_amps = np.round(
        (rated_power_kw * 1.9 * (load_percent / 100) + RNG.normal(0, 6, n)).clip(1, None), 1
    )
    power_factor = np.round(RNG.normal(0.88, 0.05, n).clip(0.6, 0.99), 3)

    asset_effect = np.where(asset_type == "compressor", 0.6,
                    np.where(asset_type == "pump", 0.1, -0.2))
    maint_effect = np.where(maintenance_type_last == "none", 0.7,
                    np.where(maintenance_type_last == "corrective", 0.3,
                    np.where(maintenance_type_last == "preventive", -0.2, -0.4)))

    logit = (
        -4.5
        + 0.55 * (vibration_rms_mm_s - 2.8)                  # ISO 10816 zone B threshold
        + 0.06 * (bearing_temp_c - 70)
        + 0.04 * (motor_winding_temp_c - 95)
        + 0.08 * (oil_particle_count_iso4406 - 40)
        + 0.000045 * runtime_since_overhaul_hours
        + 0.004 * last_maintenance_days_ago
        + 0.018 * num_starts_30d
        + 0.02 * (load_percent - 75)
        - 1.2 * power_factor
        + asset_effect
        + maint_effect
        + RNG.normal(0, 0.5, n)
    )
    failure_within_30d = _bernoulli(_sigmoid(logit))

    df = pd.DataFrame(
        {
            "equipment_id": [f"EQ-{i:06d}" for i in range(n)],
            "asset_type": asset_type,
            "manufacturer": manufacturer,
            "plant_site": plant_site,
            "criticality": criticality,
            "rated_power_kw": rated_power_kw,
            "rated_rpm": rated_rpm,
            "operating_hours": operating_hours,
            "runtime_since_overhaul_hours": runtime_since_overhaul_hours,
            "last_maintenance_days_ago": last_maintenance_days_ago,
            "maintenance_type_last": maintenance_type_last,
            "num_starts_30d": num_starts_30d,
            "load_percent": load_percent,
            "ambient_temp_c": ambient_temp_c,
            "humidity_percent": humidity_percent,
            "vibration_rms_mm_s": vibration_rms_mm_s,
            "vibration_peak_g": vibration_peak_g,
            "bearing_temp_c": bearing_temp_c,
            "motor_winding_temp_c": motor_winding_temp_c,
            "oil_temp_c": oil_temp_c,
            "oil_pressure_bar": oil_pressure_bar,
            "oil_particle_count_iso4406": oil_particle_count_iso4406,
            "suction_pressure_bar": suction_pressure_bar,
            "discharge_pressure_bar": discharge_pressure_bar,
            "flow_rate_m3_h": flow_rate_m3_h,
            "current_draw_amps": current_draw_amps,
            "power_factor": power_factor,
            "failure_within_30d": failure_within_30d,
        }
    )
    for col, rate in [
        ("humidity_percent", 0.02),
        ("oil_pressure_bar", 0.02),
        ("oil_particle_count_iso4406", 0.04),
        ("power_factor", 0.01),
    ]:
        df[col] = _inject_missing(df[col], rate)
    return df


def main() -> None:
    specs = [
        ("customer_churn.csv", make_customer_churn, "churned", "binary classification"),
        ("manufacturing_defects.csv", make_manufacturing_defects, "defect_rate_percent", "regression"),
        ("loan_default.csv", make_loan_default, "defaulted", "binary classification"),
        ("equipment_failure.csv", make_equipment_failure, "failure_within_30d", "binary classification"),
    ]
    for fname, builder, target, task in specs:
        df = builder()
        out = OUT_DIR / fname
        df.to_csv(out, index=False)
        if df[target].dtype.kind in "iu" and df[target].nunique() <= 10:
            rate = df[target].mean()
            extra = f"positive rate: {rate:.1%}"
        else:
            extra = f"mean: {df[target].mean():.2f}, std: {df[target].std():.2f}"
        print(f"{fname:30s}  rows={len(df):5d}  cols={df.shape[1]:2d}  target={target!r:30s}  ({task}, {extra})")
    print(f"\nSaved to: {OUT_DIR}")


if __name__ == "__main__":
    main()
