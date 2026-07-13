"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        style?: Record<string, unknown>;
        createSubscription: (
          data: unknown,
          actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } }
        ) => Promise<string>;
        onApprove: (data: { subscriptionID?: string }) => void;
        onError?: (err: unknown) => void;
      }) => { render: (selector: string) => void };
    };
  }
}

interface PayPalSubscribeButtonProps {
  onSubscribed: (subscriptionId: string) => void;
  onError: (message: string) => void;
}

export default function PayPalSubscribeButton({ onSubscribed, onError }: PayPalSubscribeButtonProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const planId = process.env.NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID;

  useEffect(() => {
    if (!sdkReady || renderedRef.current || !window.paypal || !containerRef.current || !planId) {
      return;
    }
    renderedRef.current = true;

    window.paypal
      .Buttons({
        style: { shape: "pill", color: "blue", layout: "horizontal", label: "subscribe" },
        createSubscription: (_data, actions) => actions.subscription.create({ plan_id: planId }),
        onApprove: (data) => {
          if (data.subscriptionID) onSubscribed(data.subscriptionID);
        },
        onError: (err) => {
          onError(err instanceof Error ? err.message : "PayPal checkout failed.");
        },
      })
      .render("#paypal-subscribe-button");
  }, [sdkReady, planId, onSubscribed, onError]);

  if (!clientId || !planId) {
    return (
      <p style={{ color: "var(--text-faint, #7a8093)", fontSize: "0.82rem" }}>
        PayPal checkout isn&apos;t configured yet.
      </p>
    );
  }

  return (
    <>
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`}
        onReady={() => setSdkReady(true)}
      />
      <div id="paypal-subscribe-button" ref={containerRef} />
    </>
  );
}
