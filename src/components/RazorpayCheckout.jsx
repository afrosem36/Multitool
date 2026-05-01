import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '../utils/api';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      return resolve(true);
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout script'));
    document.body.appendChild(script);
  });
}

function formatAmount(amount) {
  return Number(amount) / 100;
}

const RazorpayCheckout = () => {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;

  useEffect(() => {
    loadRazorpayScript()
      .then(() => setScriptLoaded(true))
      .catch((error) => {
        console.error('Razorpay script error:', error);
        toast.error('Unable to load payment checkout. Please refresh.');
      });
  }, []);

  const handlePayment = async () => {
    if (!razorpayKey) {
      toast.error('Razorpay key is not configured.');
      return;
    }

    setLoading(true);
    try {
      const order = await apiFetch('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({
          amount: 100,
          currency: 'INR',
          receipt: `receipt_${Date.now()}`,
        }),
      });

      if (!window.Razorpay) {
        throw new Error('Razorpay checkout is not available');
      }

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'MultiTool',
        description: 'Razorpay standard checkout test payment',
        handler: async (paymentResult) => {
          try {
            await apiFetch('/api/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_payment_id: paymentResult.razorpay_payment_id,
                razorpay_order_id: paymentResult.razorpay_order_id,
                razorpay_signature: paymentResult.razorpay_signature,
              }),
            });

            toast.success('Payment verified successfully');
          } catch (verifyError) {
            console.error('Payment verification failed:', verifyError);
            toast.error(verifyError.message || 'Payment verification failed');
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            toast.error('Payment was cancelled.');
            setLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (failureData) => {
        console.error('Razorpay payment failed:', failureData);
        toast.error('Payment failed or cancelled.');
        setLoading(false);
      });
      razorpay.open();
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Unable to start payment');
      setLoading(false);
    }
  };

  return (
    <section className="feature-section" style={{ padding: '1.5rem 1rem' }}>
      <div className="glass-panel" style={{ padding: '1.75rem', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Razorpay Checkout</h2>
            <p style={{ margin: '0.75rem 0', color: 'var(--text-secondary)' }}>
              Start a secure Razorpay payment flow using the backend order creation and signature verification endpoints.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handlePayment}
              disabled={loading || !scriptLoaded}
              style={{ minWidth: '220px' }}
            >
              {loading ? 'Opening checkout…' : 'Pay ₹1 via Razorpay'}
            </button>
            {!scriptLoaded && (
              <span style={{ color: 'var(--text-secondary)' }}>
                Loading Razorpay checkout...
              </span>
            )}
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            <p style={{ margin: 0 }}>
              This flow creates a backend order and verifies the payment signature without exposing the secret key to the client.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RazorpayCheckout;
