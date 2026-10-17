import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectProject } from '../inspector.js';

export interface MonetizeScaffoldResult {
  checkoutRoute: string;
  webhookRoute: string;
  pricingComponent: string;
  specFile: string;
  envUpdated: boolean;
  createdFiles: string[];
}

export function generateCheckoutRouteSource(isNextAppRouter: boolean): string {
  if (isNextAppRouter) {
    return `import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: NextRequest) {
  try {
    const { priceId, customerEmail, successUrl, cancelUrl } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Missing required parameter: priceId' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: customerEmail,
      success_url: successUrl || \`\${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: cancelUrl || \`\${appUrl}/pricing\`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
`;
  }

  return `import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const { priceId, customerEmail, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Missing required parameter: priceId' });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: customerEmail,
      success_url: successUrl || \`\${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: cancelUrl || \`\${appUrl}/pricing\`,
      allow_promotion_codes: true,
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
`;
}

export function generateWebhookRouteSource(isNextAppRouter: boolean): string {
  if (isNextAppRouter) {
    return `import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: \`Webhook Error: \${err.message}\` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Payment checkout completed for customer:', session.customer_email);
      // TODO: Grant user license or entitlement in database
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('Subscription status updated:', subscription.id, subscription.status);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log('Subscription cancelled:', subscription.id);
      // TODO: Revoke pro permissions in database
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn('Payment failed for invoice:', invoice.id);
      break;
    }
    default:
      console.log(\`Unhandled Stripe event: \${event.type}\`);
  }

  return NextResponse.json({ received: true });
}
`;
  }

  return `import { Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return res.status(400).send('Missing signature or webhook secret');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(\`Webhook Error: \${err.message}\`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      console.log('Checkout completed:', event.data.object);
      break;
    case 'customer.subscription.deleted':
      console.log('Subscription cancelled:', event.data.object);
      break;
    default:
      console.log(\`Unhandled event: \${event.type}\`);
  }

  return res.json({ received: true });
}
`;
}

export function generatePricingTableComponentSource(): string {
  return `'use client';

import React, { useState } from 'react';

export interface PricingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: string[];
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  popular?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 19,
    priceYearly: 190,
    description: 'Perfect for solo developers and indie makers.',
    features: ['1 Production Project', 'Community Support', 'Up to 10k API calls/mo', 'Core Features'],
    stripePriceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY || 'price_starter_mo',
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY || 'price_starter_yr',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    priceYearly: 490,
    description: 'For growing businesses requiring speed and priority features.',
    features: ['Unlimited Projects', 'Priority 24/7 Support', '100k API calls/mo', 'Advanced Analytics', 'Custom Domains'],
    stripePriceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY || 'price_pro_mo',
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY || 'price_pro_yr',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 149,
    priceYearly: 1490,
    description: 'Dedicated infrastructure, custom SLAs and security audits.',
    features: ['Custom Contract & Invoicing', 'Dedicated Account Manager', 'SSO & SAML Auth', '99.99% SLA Guarantee', 'Audit Logs'],
    stripePriceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_MONTHLY || 'price_ent_mo',
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY || 'price_ent_yr',
  },
];

export function PricingTable() {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (plan: PricingPlan) => {
    try {
      setLoadingPlan(plan.id);
      const priceId = isYearly ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initiate checkout.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 12px' }}>Simple, Transparent Pricing</h2>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>Choose the tier that fits your growth. Cancel anytime.</p>
        <div style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#f4f4f5', padding: '6px 12px', borderRadius: '24px' }}>
          <button
            onClick={() => setIsYearly(false)}
            style={{ padding: '6px 16px', borderRadius: '18px', border: 'none', background: !isYearly ? '#000' : 'transparent', color: !isYearly ? '#fff' : '#000', cursor: 'pointer', fontWeight: 600 }}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            style={{ padding: '6px 16px', borderRadius: '18px', border: 'none', background: isYearly ? '#000' : 'transparent', color: isYearly ? '#fff' : '#000', cursor: 'pointer', fontWeight: 600 }}
          >
            Yearly <span style={{ color: '#10b981', fontSize: '0.8rem' }}>(Save 20%)</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            style={{
              border: plan.popular ? '2px solid #6366f1' : '1px solid #e4e4e7',
              borderRadius: '16px',
              padding: '32px',
              background: '#fff',
              position: 'relative',
              boxShadow: plan.popular ? '0 10px 25px -5px rgba(99, 102, 241, 0.15)' : 'none',
            }}
          >
            {plan.popular && (
              <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '12px' }}>
                MOST POPULAR
              </span>
            )}
            <h3 style={{ fontSize: '1.4rem', margin: '0 0 8px' }}>{plan.name}</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', minHeight: '40px' }}>{plan.description}</p>
            <div style={{ margin: '24px 0', fontSize: '2.5rem', fontWeight: 800 }}>
              \${isYearly ? plan.priceYearly : plan.priceMonthly}
              <span style={{ fontSize: '1rem', color: '#888', fontWeight: 400 }}>/{isYearly ? 'yr' : 'mo'}</span>
            </div>
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={loadingPlan === plan.id}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: plan.popular ? '#6366f1' : '#18181b',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '24px',
              }}
            >
              {loadingPlan === plan.id ? 'Processing...' : \`Get Started with \${plan.name}\`}
            </button>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.95rem' }}>
              {plan.features.map((f, i) => (
                <li key={i} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <span style={{ color: '#10b981' }}>✔</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

export function generateMonetizationSpecMarkdown(projectName: string): string {
  const dateStr = new Date().toISOString().substring(0, 10);
  return `# Commercial Monetization Architecture: ${projectName}

> **Project**: ${projectName} • **Date**: ${dateStr} • **Provider**: Stripe

---

## 1. Billing Flow & Architecture
1. **User Selection**: User chooses monthly or annual tier on \`<PricingTable />\`.
2. **Checkout Initiation**: \`POST /api/billing/checkout\` validates \`priceId\` and calls Stripe API to generate hosted Checkout session.
3. **Redirection**: User completes credit card / Apple Pay payment on Stripe's secure PCI-DSS checkout page.
4. **Webhook Processing**: Stripe fires \`checkout.session.completed\` to \`/api/billing/webhook\`.
5. **Entitlement Provisioning**: Webhook verifies cryptographic signature and unlocks subscriber features in the database.

---

## 2. Testing Stripe Webhooks Locally
Use the official Stripe CLI to forward events to your local dev server:

\`\`\`powershell
# 1. Install Stripe CLI (if not installed)
# winget install Stripe.StripeCLI

# 2. Login to Stripe
stripe login

# 3. Forward webhook events to local vibe dev server
stripe listen --forward-to localhost:3000/api/billing/webhook

# 4. Trigger test checkout event
stripe trigger checkout.session.completed
\`\`\`

---

## 3. Production Readiness Checklist
- [ ] Set live \`STRIPE_SECRET_KEY\` and \`STRIPE_WEBHOOK_SECRET\` in production environment.
- [ ] Configure Stripe Customer Portal for self-service invoice downloads & cancellations.
- [ ] Setup tax collection via Stripe Tax.
- [ ] Connect webhook endpoint in Stripe Dashboard with HTTPS.
`;
}

/**
 * Scaffolds the complete commercial monetization suite.
 */
export async function scaffoldMonetizationSuite(cwd: string): Promise<MonetizeScaffoldResult> {
  const meta = await inspectProject(cwd);
  const isNextApp = (await fs.pathExists(path.join(cwd, 'app'))) || (await fs.pathExists(path.join(cwd, 'src', 'app')));
  const baseSrc = (await fs.pathExists(path.join(cwd, 'src'))) ? path.join(cwd, 'src') : cwd;

  const createdFiles: string[] = [];

  // 1. Checkout route
  let checkoutPath = '';
  if (isNextApp) {
    const appDir = (await fs.pathExists(path.join(cwd, 'src', 'app'))) ? path.join(cwd, 'src', 'app') : path.join(cwd, 'app');
    checkoutPath = path.join(appDir, 'api', 'billing', 'checkout', 'route.ts');
  } else {
    checkoutPath = path.join(baseSrc, 'routes', 'billing.ts');
  }

  await fs.ensureDir(path.dirname(checkoutPath));
  if (!(await fs.pathExists(checkoutPath))) {
    await fs.writeFile(checkoutPath, generateCheckoutRouteSource(isNextApp), 'utf8');
    createdFiles.push(path.relative(cwd, checkoutPath).replace(/\\/g, '/'));
  }

  // 2. Webhook route
  let webhookPath = '';
  if (isNextApp) {
    const appDir = (await fs.pathExists(path.join(cwd, 'src', 'app'))) ? path.join(cwd, 'src', 'app') : path.join(cwd, 'app');
    webhookPath = path.join(appDir, 'api', 'billing', 'webhook', 'route.ts');
  } else {
    webhookPath = path.join(baseSrc, 'routes', 'webhook.ts');
  }

  await fs.ensureDir(path.dirname(webhookPath));
  if (!(await fs.pathExists(webhookPath))) {
    await fs.writeFile(webhookPath, generateWebhookRouteSource(isNextApp), 'utf8');
    createdFiles.push(path.relative(cwd, webhookPath).replace(/\\/g, '/'));
  }

  // 3. Pricing table component
  const componentsDir = path.join(baseSrc, 'components');
  await fs.ensureDir(componentsDir);
  const pricingPath = path.join(componentsDir, 'PricingTable.tsx');
  if (!(await fs.pathExists(pricingPath))) {
    await fs.writeFile(pricingPath, generatePricingTableComponentSource(), 'utf8');
    createdFiles.push(path.relative(cwd, pricingPath).replace(/\\/g, '/'));
  }

  // 4. Update .env.example
  let envUpdated = false;
  const envExamplePath = path.join(cwd, '.env.example');
  const stripeEnvTemplate = `\n# Stripe Commercial Billing\nSTRIPE_SECRET_KEY=sk_test_your_key_here\nSTRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret\nNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key\n`;

  if (await fs.pathExists(envExamplePath)) {
    const currentEnv = await fs.readFile(envExamplePath, 'utf8');
    if (!currentEnv.includes('STRIPE_SECRET_KEY')) {
      await fs.writeFile(envExamplePath, currentEnv + stripeEnvTemplate, 'utf8');
      envUpdated = true;
    }
  } else {
    await fs.writeFile(envExamplePath, stripeEnvTemplate.trim() + '\n', 'utf8');
    envUpdated = true;
    createdFiles.push('.env.example');
  }

  // 5. Obsidian spec
  const vaultSpecsDir = path.join(cwd, '.vault', 'Specs');
  const targetSpecsDir = (await fs.pathExists(path.join(cwd, '.vault'))) ? vaultSpecsDir : path.join(cwd, 'docs');
  await fs.ensureDir(targetSpecsDir);
  const specFile = path.join(targetSpecsDir, 'Monetization-Architecture.md');

  if (!(await fs.pathExists(specFile))) {
    await fs.writeFile(specFile, generateMonetizationSpecMarkdown(path.basename(cwd)), 'utf8');
    createdFiles.push(path.relative(cwd, specFile).replace(/\\/g, '/'));
  }

  return {
    checkoutRoute: path.relative(cwd, checkoutPath).replace(/\\/g, '/'),
    webhookRoute: path.relative(cwd, webhookPath).replace(/\\/g, '/'),
    pricingComponent: path.relative(cwd, pricingPath).replace(/\\/g, '/'),
    specFile: path.relative(cwd, specFile).replace(/\\/g, '/'),
    envUpdated,
    createdFiles,
  };
}

/**
 * vibe monetize [targetDir]
 */
export async function monetizeCommand(targetDirInput?: string): Promise<void> {
  const cwd = targetDirInput ? path.resolve(targetDirInput) : process.cwd();
  const projectName = path.basename(cwd);

  p.intro(pc.bgGreen(pc.black(' vibe monetize ')) + ' ' + pc.bold('Commercial Revenue & Billing Engine'));

  const s = p.spinner();
  s.start(`Scaffolding Stripe billing and commercial subscription portal for ${projectName}...`);

  const result = await scaffoldMonetizationSuite(cwd);

  s.stop(pc.green('Commercial billing architecture ready!'));

  p.note(
    `Checkout Endpoint: ${pc.cyan(result.checkoutRoute)}\n` +
      `Webhook Handler:   ${pc.cyan(result.webhookRoute)}\n` +
      `Pricing Component: ${pc.cyan(result.pricingComponent)}\n` +
      `Architecture Spec: ${pc.white(result.specFile)}\n` +
      `Environment Keys:  ${result.envUpdated ? pc.green('Updated .env.example') : pc.dim('Already configured')}\n\n` +
      `Created ${result.createdFiles.length} file(s):\n` +
      result.createdFiles.map((f) => `  ✔ ${pc.bold(f)}`).join('\n'),
    'Monetization Suite Scaffolding'
  );

  p.outro('Stripe billing infrastructure active. Run `stripe listen` to test webhooks!');
}
