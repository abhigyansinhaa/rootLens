export type ColumnSchema = {
  name: string
  dtype: string
  null_ratio: number
  n_unique: number
  sample_values: string[]
}

export type Dataset = {
  id: number
  name: string
  filename: string
  file_format: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  created_at: string
}

export type DriverImpactRollup = {
  delta_target_rate: number
  users_savable: number
  revenue_recoverable?: number | null
  confidence_tier?: 'high' | 'medium' | 'low'
  confidence_signals?: Record<string, unknown>
}

export type AnalysisKpis = {
  target_level: {
    n_users: number
    target_rate?: number
    predicted_target_rate?: number
    target_mean?: number
    predicted_mean?: number
    target_rate_ci_low?: number
    target_rate_ci_high?: number
    target_mean_ci_low?: number
    target_mean_ci_high?: number
    high_risk_count: number
    high_risk_share: number
    high_risk_share_ci_low?: number
    high_risk_share_ci_high?: number
  }
  impact_revenue?: {
    total_value: number
    revenue_at_risk: number
    potential_revenue_saved: number
    avg_value_high_risk: number
    currency?: string | null
    revenue_at_risk_ci_low?: number
    revenue_at_risk_ci_high?: number
  } | null
  concentration: {
    lorenz_points: { x: number; y: number }[]
    headline: { top_pct_users: number; share_of_risk: number }
    gini: number
    interpretation?: string
    pareto_cuts?: {
      top_pct: number
      share_of_risk: number
      approx_users: number
      approx_revenue_at_risk: number | null
    }[]
  }
  risk_segments: {
    bucket: 'low' | 'medium' | 'high'
    count: number
    share: number
    value?: number | null
    value_share?: number | null
    avg_proba?: number
    avg_top_driver_leverage?: number
    tractability_score: number
    easiest_to_fix: boolean
  }[]
  drivers: { feature: string; mean_abs_shap: number; share: number }[]
  top_driver_share: number
  driver_impact: {
    approximation: 'shap_zeroing' | 'linear_share'
    per_driver: {
      feature: string
      delta_target_rate: number
      users_savable: number
      revenue_recoverable?: number | null
      confidence_tier?: 'high' | 'medium' | 'low'
      confidence_signals?: Record<string, unknown>
    }[]
    top1: DriverImpactRollup
    top2: DriverImpactRollup
    top3: DriverImpactRollup
  }
  reliability: {
    score: number
    tier: 'high' | 'medium' | 'low'
    headline_metric: string
    headline_value: number
    cv_std?: number | null
    hint: string
    business_explanation?: string
  }
  intervention_confidence?: {
    tier: 'high' | 'medium' | 'low'
    rationale_bullets: string[]
  }
}

export type AnalysisReport = {
  profile?: {
    dataset_health?: Record<string, unknown>
    target_suitability?: Record<string, unknown>
    warnings?: string[]
    blocking_errors?: string[]
    task_type_hint?: string | null
  }
  model?: {
    kind?: string
    validation_strategy?: string
    confidence?: string
    cv_metrics?: Record<string, number>
  }
  grouped_drivers?: { feature: string; mean_abs_shap: number; mean_signed_shap: number; direction: string }[]
  data_warnings?: string[]
  user_message?: string | null
  fallbacks?: string[]
  kpis?: AnalysisKpis
  trust_copy?: {
    counterfactual_causal_disclaimer?: string
    correlation_not_causation?: string
    roi_assumptions?: string
  }
  ui_thresholds?: Record<string, unknown>
  quality_signals?: { scope: string; severity: string; message: string }[]
  model_baselines?: Record<string, number>
  governance?: Record<string, unknown>
}

export type Analysis = {
  id: number
  dataset_id: number
  target: string
  datetime_column?: string | null
  value_column?: string | null
  task_type: string | null
  status: string
  metrics: Record<string, unknown> | null
  insights: {
    feature: string
    kind: string
    task_type: string
    summary: string
    mean_abs_shap: number
    grouped_feature?: string
    confidence?: string
    severity?: 'informational' | 'warning' | 'critical'
    investigation_questions?: string[]
  }[] | null
  recommendations: string[] | null
  feature_importance: { feature: string; importance: number; mean_abs_shap: number }[] | null
  shap_summary: {
    feature: string
    mean_abs_shap: number
    mean_signed_shap: number
    direction: string
    xgb_importance: number
  }[] | null
  shap_summary_image_url: string | null
  shap_beeswarm_image_url?: string | null
  model_metadata?: Record<string, unknown> | null
  report: AnalysisReport | null
  error: string | null
  created_at: string
  completed_at: string | null
  pipeline_version?: string | null
  encoder_version?: string | null
  schema_hash?: string | null
  dataset_hash?: string | null
}

export type AnalysisListItem = {
  id: number
  dataset_id: number
  dataset_name: string
  target: string
  datetime_column?: string | null
  task_type: string | null
  status: string
  value_column?: string | null
  created_at: string
  completed_at: string | null
  kpi_summary: {
    headline?: { top_pct_users: number; share_of_risk: number }
    top2_impact?: DriverImpactRollup
    approximation?: string
  } | null
}

export type KpiHistoryPoint = {
  analysis_id: number
  completed_at: string | null
  kpis: {
    target_rate?: number
    predicted_target_rate?: number
    target_mean?: number
    predicted_mean?: number
    high_risk_share?: number
    revenue_at_risk?: number | null
    concentration_headline?: { top_pct_users: number; share_of_risk: number }
    segment_shares?: Record<string, number>
    reliability_value?: number
  }
}

export type KpiHistoryResponse = {
  points: KpiHistoryPoint[]
  current_analysis_id: number
}

export type DatasetProfile = {
  ok: boolean
  blocking_errors: string[]
  warnings: string[]
  dataset_health: Record<string, unknown>
  target_suitability: Record<string, unknown>
  task_type_hint: string | null
}
