import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUpCircle, ArrowDownCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CashInOutButtonsProps {
  userId: string;
  userChips: number;
}

export function CashInOutButtons({ userId, userChips }: CashInOutButtonsProps) {
  const { toast } = useToast();
  const [cashAmount, setCashAmount] = useState(1000);
  const [showCashIn, setShowCashIn] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingCashOut, setIsSubmittingCashOut] = useState(false);
  const [gcashNumber, setGcashNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProofImage = async (): Promise<string | null> => {
    if (!proofImage || !userId) return null;
    
    const fileExt = proofImage.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('cash-proofs')
      .upload(fileName, proofImage);
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('cash-proofs')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleCashRequest = async (type: 'cash_in' | 'cash_out') => {
    if (!userId || cashAmount <= 0) return;
    
    if (type === 'cash_in' && isUploading) return;
    if (type === 'cash_out' && isSubmittingCashOut) return;
    
    if (type === 'cash_in') {
      setIsUploading(true);
    } else {
      setIsSubmittingCashOut(true);
    }
    
    let proofUrl: string | null = null;
    if (type === 'cash_in' && proofImage) {
      proofUrl = await uploadProofImage();
      if (!proofUrl) {
        toast({ title: 'Error', description: 'Failed to upload proof image', variant: 'destructive' });
        setIsUploading(false);
        return;
      }
    }

    const { error } = await supabase
      .from('cash_requests')
      .insert({
        user_id: userId,
        request_type: type,
        amount: cashAmount,
        proof_image_url: proofUrl,
        gcash_number: type === 'cash_out' ? gcashNumber : null
      });

    setIsUploading(false);
    setIsSubmittingCashOut(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: 'Request Submitted', 
        description: `Your ${type === 'cash_in' ? 'cash in' : 'cash out'} request for ${cashAmount} chips has been submitted for admin approval.` 
      });
      setShowCashIn(false);
      setShowCashOut(false);
      setCashAmount(1000);
      setProofImage(null);
      setProofPreview(null);
      setGcashNumber('');
    }
  };

  return (
    <>
      <Dialog open={showCashIn} onOpenChange={setShowCashIn}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="border-green-500/50 text-green-400 hover:bg-green-500/10">
            <ArrowDownCircle className="h-4 w-4 mr-1" />
            Cash In
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash In Request</DialogTitle>
            <DialogDescription>Request chips to be added to your account. Admin approval required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-400 mb-1">Send payment via GCash:</p>
              <p className="text-lg font-bold text-blue-300">09152274107</p>
              <p className="text-xs text-muted-foreground mt-1">Upload your payment screenshot below</p>
            </div>
            
            <div>
              <Label>Amount (in chips)</Label>
              <Input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(parseInt(e.target.value) || 0)}
                min={100}
              />
            </div>
            
            <div>
              <Label>Payment Proof (Screenshot)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {proofImage ? 'Change Image' : 'Upload Screenshot'}
              </Button>
              {proofPreview && (
                <div className="mt-3 relative">
                  <img src={proofPreview} alt="Proof" className="max-h-40 mx-auto rounded border border-border" />
                  <p className="text-xs text-muted-foreground mt-2 text-center">Payment proof uploaded</p>
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => handleCashRequest('cash_in')} 
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
              disabled={isUploading || !proofImage}
            >
              {isUploading ? 'Uploading...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCashOut} onOpenChange={setShowCashOut}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
            <ArrowUpCircle className="h-4 w-4 mr-1" />
            Cash Out
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash Out Request</DialogTitle>
            <DialogDescription>Request to withdraw chips from your account. Admin approval required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>GCash Number</Label>
              <Input
                type="tel"
                placeholder="09XXXXXXXXX"
                value={gcashNumber}
                onChange={(e) => setGcashNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground mt-1">Enter your GCash number for payout</p>
            </div>
            <div>
              <Label>Amount (Max: {userChips})</Label>
              <Input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(Math.min(parseInt(e.target.value) || 0, userChips))}
                min={100}
                max={userChips}
              />
            </div>
            <Button 
              onClick={() => handleCashRequest('cash_out')} 
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              disabled={cashAmount > userChips || isSubmittingCashOut || gcashNumber.length !== 11}
            >
              {isSubmittingCashOut ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
