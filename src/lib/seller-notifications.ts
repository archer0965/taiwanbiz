export type SellerNotificationKind =
  | "subscription_expiry_reminder"
  | "subscription_expired"
  | "subscription_trial_ending"
  | "system";

export type SellerNotification = {
  id: string;
  storeId: string;
  ownerEmail: string;
  kind: SellerNotificationKind;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  readAt: string | null;
};
