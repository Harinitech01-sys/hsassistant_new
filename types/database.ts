// types/database.ts

export interface LoyaltyAccount {
  loyalty_id: number;
  is_active: number; // or boolean depending on your DB setup
  generated_date: string;
}

export interface SchedulerLog {
  id: number;
  scheduler: string;
  key_column: string | null;
  record_count: number;
  status: string;
  run_date: string;
  start_time: string;
  end_time: string;
}

export interface OrderLineItem {
  load_date: string;
  order_line_number: string;
  customer_account_number: number;
  loyalty_id: number;
  date_of_transaction: string;
  order_line_step_code: string;
  extended_sales_amount: number;
  total_redeemable_points: number;
  points_left_to_redeem: number;
  points_redeemed: number;
  gl_cost_center_code: number;
  business_unit_description: string;
  mktcls_modified: number;
  dormant_account_flag: number;
  product_primary_class_id: string;
  customer_billto_account_number: number;
  certificate_redeemed_flag: number;
  product_short_description: string;
}