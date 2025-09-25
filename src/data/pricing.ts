
export type PlanFeatures = {
  userSeats: string;
  storageLimit: string;
  integrationCount: string;
  supportType: string;
};

export type PricingPlan = {
  name: string;
  key: string;
  price: string;
  savings?: string;
  features: PlanFeatures;
  color: string;
  stripePrice?: string;
  popular?: boolean;
};

export type PricingData = {
  monthly: PricingPlan[];
  annual: PricingPlan[];
};

export const pricingData: PricingData = {
  monthly: [
    {
      name: 'Free',
      key: 'free',
      price: '$0',
      features: { userSeats: '1 User', storageLimit: '10 VivRecords', integrationCount: '3 Integrations', supportType: 'Email Support' },
      color: 'blue-700',
      stripePrice: 'price_1QIOyMA1fqqUyUMdzeIt3Zsi'
    },
    {
      name: 'Basic',
      key: 'basic',
      price: '$15',
      features: { userSeats: '3 Users', storageLimit: '50 VivRecords', integrationCount: '5 Integrations', supportType: 'Email Support' },
      color: 'purple-700',
      stripePrice: 'price_1QIOyMA1fqqUyUMdzeIt3Zsi'
    },
    {
      name: 'Pro',
      key: 'pro',
      price: '$49',
      features: { userSeats: '5 Users', storageLimit: '500 VivRecords', integrationCount: 'All Integrations', supportType: 'Priority Email Support' },
      color: 'red-700',
      popular: true,
      stripePrice: 'price_1QIOyKA1fqqUyUMdh4YeqBLO'
    },
    {
      name: 'Pro Plus',
      key: 'proplus',
      price: '$99',
      features: { userSeats: '15 Users', storageLimit: '1500 VivRecords', integrationCount: 'All Integrations', supportType: 'Premium Support'},
      color: 'green-700',
      stripePrice: 'price_1QIOyIA1fqqUyUMdghn12jc9'
    },
    {
      name: 'Enterprise',
      key: 'enterprise',
      price: 'Reach Out',
      features: { userSeats: 'Unlimited Users', storageLimit: 'Unlimited VivRecords', integrationCount: 'Unlimited Bandwidth', supportType: 'Dedicated Support' },
      color: 'yellow-700',
    },
  ],
  annual: [
    {
      name: 'Free',
      key: 'free',
      price: '$0',
      features: { userSeats: '1 User', storageLimit: '10 VivRecords', integrationCount: '3 Integrations', supportType: 'Email Support' },
      color: 'blue-700',
      stripePrice: 'price_1QIOyMA1fqqUyUMdzeIt3Zsi'
    },
    {
      name: 'Basic',
      key: 'basic',
      price: '$13',
      savings: '$24',
      features: { userSeats: '3 Users', storageLimit: '50 VivRecords', integrationCount: '5 Integrations', supportType: 'Email Support' },
      color: 'purple-700',
      stripePrice: 'price_1QIOyFA1fqqUyUMdZ6PgUk70'
    },
    {
      name: 'Pro',
      key: 'pro',
      price: '$45',
      savings: '$48',
      features: { userSeats: '5 Users', storageLimit: '500 VivRecords', integrationCount: 'All Integrations', supportType: 'Priority Email Support' },
      color: 'red-700',
      popular: true,
      stripePrice: 'price_1QIOyDA1fqqUyUMd3jwakTZ3'
    },
    {
      name: 'Pro Plus',
      key: 'proplus',
      price: '$90',
      savings: '$108',
      features: { userSeats: '15 Users', storageLimit: '1500 VivRecords', integrationCount: 'All Integrations', supportType: 'Premium Support'},
      color: 'green-700',
      stripePrice: 'price_1QIOyBA1fqqUyUMdtMqywBN7'
    },
    {
      name: 'Enterprise',
      key: 'enterprise',
      price: 'Reach Out',
      features: { userSeats: 'Unlimited Users', storageLimit: 'Unlimited VivRecords', integrationCount: 'Unlimited Bandwidth', supportType: 'Dedicated Support' },
      color: 'yellow-700',
    },
  ],
};
