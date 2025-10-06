# 💳 Complete Payment Integration Testing Guide

## 🚀 Prerequisites

### 1. Stripe Test Environment Setup
Ensure your `.env` file has Stripe test keys:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Test Price IDs
Create test products in Stripe Dashboard or use these test price IDs:
- `price_1234567890abcdef` (Monthly $29.99)
- `price_abcdef1234567890` (Annual $299.99)

## 🔐 Step 1: Get Authorization Token

1. **Start server**: `npm run dev`
2. **Open Swagger UI**: `http://localhost:3000/api-docs`
3. **Register/Login** and get authorization token
4. **Authorize** in Swagger UI with `Bearer YOUR_TOKEN`

## 🏢 Step 2: Create Organization

**Endpoint**: `POST /api/organizations`
```json
{
  "name": "Payment Test Company",
  "description": "Testing payment integration",
  "website": "https://paymenttest.com"
}
```
**📝 Copy the organization ID for payment tests**

## 💳 Step 3: Payment Integration Testing

### Test 1: Create Subscription (Backend)
**Endpoint**: `POST /api/payments/subscriptions`
```json
{
  "priceId": "price_1234567890abcdef",
  "organizationId": "YOUR_ORGANIZATION_ID"
}
```

**Expected Response**:
```json
{
  "message": "Subscription created successfully",
  "subscription": {
    "id": "sub_1234567890abcdef",
    "status": "incomplete",
    "clientSecret": "pi_1234567890abcdef_secret_xyz"
  }
}
```

**📝 Copy the `clientSecret` for frontend payment confirmation**

### Test 2: Frontend Payment Confirmation

Since your backend creates the subscription but requires frontend confirmation, you need to test the complete flow:

#### Option A: Using Stripe's Test Card UI

1. **Create a simple HTML test page**:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Payment Test</title>
    <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
    <div id="payment-element"></div>
    <button id="submit-btn">Pay Now</button>
    
    <script>
        const stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY');
        const clientSecret = 'pi_1234567890abcdef_secret_xyz'; // From API response
        
        const elements = stripe.elements({
            clientSecret: clientSecret
        });
        
        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');
        
        document.getElementById('submit-btn').addEventListener('click', async () => {
            const {error} = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: 'http://localhost:3000/payment-success'
                }
            });
            
            if (error) {
                console.error('Payment failed:', error);
            } else {
                console.log('Payment succeeded!');
            }
        });
    </script>
</body>
</html>
```

#### Option B: Using Stripe Test Cards

Use these test card numbers in your payment form:

**✅ Successful Cards:**
- `4242424242424242` - Visa (succeeds)
- `4000056655665556` - Visa (debit, succeeds)
- `5555555555554444` - Mastercard (succeeds)
- `378282246310005` - American Express (succeeds)

**❌ Declined Cards:**
- `4000000000000002` - Card declined
- `4000000000009995` - Insufficient funds
- `4000000000009987` - Lost card
- `4000000000009979` - Stolen card

**🔄 Special Test Cases:**
- `4000000000000069` - Expired card
- `4000000000000127` - Incorrect CVC
- `4000000000000119` - Processing error

**Test Details for All Cards:**
- **Expiry**: Any future date (e.g., 12/25)
- **CVC**: Any 3-digit number (e.g., 123)
- **ZIP**: Any 5-digit number (e.g., 12345)

### Test 3: Verify Subscription Status
**Endpoint**: `GET /api/payments/subscriptions/{organizationId}`

Should show the subscription with status `active` after successful payment.

### Test 4: One-Time Payment Testing
**Endpoint**: `POST /api/payments/payment-intents`
```json
{
  "amount": 2999,
  "currency": "usd",
  "organizationId": "YOUR_ORGANIZATION_ID",
  "description": "One-time setup fee"
}
```

Use the returned `clientSecret` with the same frontend confirmation process.

## 🧪 Complete Payment Flow Testing

### Scenario 1: Successful Subscription
1. Create subscription via API
2. Use test card `4242424242424242`
3. Confirm payment in frontend
4. Verify subscription is `active`
5. Check payment history

### Scenario 2: Failed Payment
1. Create subscription via API
2. Use declined card `4000000000000002`
3. Verify payment fails gracefully
4. Check subscription remains `incomplete`

### Scenario 3: Subscription Management
1. Create active subscription
2. Update subscription plan
3. Cancel subscription
4. Verify status changes

## 🔍 Testing Webhook Integration

### Test Webhook Locally

1. **Install Stripe CLI**:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

2. **Trigger Test Events**:
```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test subscription created
stripe trigger customer.subscription.created

# Test invoice paid
stripe trigger invoice.payment_succeeded
```

3. **Verify Webhook Processing**:
Check your server logs and database for webhook event processing.

## 📊 Payment Testing Checklist

### ✅ Subscription Testing
- [ ] Create subscription with valid price ID
- [ ] Confirm payment with test card
- [ ] Verify subscription status becomes `active`
- [ ] Test subscription updates
- [ ] Test subscription cancellation
- [ ] Test failed payment handling

### ✅ One-Time Payment Testing
- [ ] Create payment intent
- [ ] Confirm payment with test card
- [ ] Verify payment success
- [ ] Test payment failures
- [ ] Check payment history

### ✅ Card Testing
- [ ] Test successful cards (4242...)
- [ ] Test declined cards (4000...0002)
- [ ] Test expired cards
- [ ] Test insufficient funds
- [ ] Test processing errors

### ✅ Webhook Testing
- [ ] Test payment succeeded webhook
- [ ] Test subscription created webhook
- [ ] Test invoice paid webhook
- [ ] Test payment failed webhook
- [ ] Verify database updates

### ✅ Customer Portal Testing
- [ ] Generate customer portal URL
- [ ] Access portal with test customer
- [ ] Update payment method
- [ ] Download invoices
- [ ] Cancel subscription

## 🎯 Advanced Testing Scenarios

### Test 1: 3D Secure Authentication
Use card: `4000000000003220`
- Requires 3D Secure authentication
- Test the authentication flow

### Test 2: International Cards
Use card: `4000000760000002` (Brazil)
- Test international payment processing

### Test 3: Subscription Trials
Create subscription with trial period:
```json
{
  "priceId": "price_with_trial",
  "organizationId": "YOUR_ORGANIZATION_ID"
}
```

### Test 4: Multiple Payment Methods
1. Add multiple cards to customer
2. Test switching between payment methods
3. Test default payment method updates

## 🚨 Common Issues & Solutions

### Issue: "No such price"
**Solution**: Create test prices in Stripe Dashboard or use valid test price IDs

### Issue: "Customer not found"
**Solution**: Ensure customer is created before subscription

### Issue: "Payment requires confirmation"
**Solution**: Use the clientSecret to confirm payment on frontend

### Issue: Webhook not receiving events
**Solution**: Check webhook endpoint URL and signature verification

## 🔧 Debug Payment Issues

### Check Stripe Dashboard
1. Go to Stripe Dashboard → Payments
2. View payment attempts and failures
3. Check webhook delivery logs

### Server Logs
Monitor your server logs for:
- Payment creation logs
- Webhook processing logs
- Error messages

### Database Verification
Check your database for:
- Subscription records
- Payment records
- Customer records

## 🎉 Success Criteria

Your payment integration is working correctly when:

1. ✅ **Subscriptions create successfully** with test price IDs
2. ✅ **Test cards process payments** without errors
3. ✅ **Webhook events update** database correctly
4. ✅ **Payment failures handle gracefully** with proper error messages
5. ✅ **Customer portal works** for subscription management
6. ✅ **Payment history displays** correctly
7. ✅ **Subscription status updates** reflect payment state

## 🚀 Ready for Production

Once all tests pass:
1. Replace test keys with live Stripe keys
2. Update webhook endpoints for production
3. Test with real (small amount) transactions
4. Monitor payment processing in production

Your payment integration is now fully tested and ready for real transactions!
