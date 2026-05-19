import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProofImageProps {
  value: string;
  alt?: string;
  className?: string;
}

/**
 * Resolves a stored proof_image_url (storage path) to a short-lived signed URL.
 * Falls back to using the value directly if it's already an http(s) URL
 * (for backwards compatibility with rows uploaded when the bucket was public).
 */
export function ProofImage({ value, alt = 'Payment proof', className }: ProofImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) return;

    if (/^https?:\/\//i.test(value)) {
      setUrl(value);
      return;
    }

    // Strip a leading "cash-proofs/" if present
    const path = value.replace(/^cash-proofs\//, '');

    supabase.storage
      .from('cash-proofs')
      .createSignedUrl(path, 60 * 10)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setError('Unable to load image');
        } else {
          setUrl(data.signedUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (error) return <div className="text-sm text-muted-foreground">{error}</div>;
  if (!url) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return <img src={url} alt={alt} className={className} />;
}
