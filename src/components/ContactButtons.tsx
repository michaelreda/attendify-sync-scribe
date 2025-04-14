import React from 'react';
import { Button } from '@/components/ui/button';
import { PhoneCall, MessageCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ContactButtonsProps {
  phoneNumber: string;
}

const ContactButtons: React.FC<ContactButtonsProps> = ({ phoneNumber }) => {
  // Format the phone number to be compatible with tel: and WhatsApp
  const formatPhoneForCall = (phone: string): string => {
    // Remove any non-digit characters
    return phone.replace(/\D/g, '');
  };

  const handleCall = () => {
    const formattedNumber = formatPhoneForCall(phoneNumber);
    if (!formattedNumber) {
      toast({
        title: "Invalid phone number",
        description: "The phone number format is invalid",
        variant: "destructive"
      });
      return;
    }
    
    window.open(`tel:${formattedNumber}`, '_blank');
  };

  const handleWhatsApp = () => {
    const formattedNumber = formatPhoneForCall(phoneNumber);
    if (!formattedNumber) {
      toast({
        title: "Invalid phone number",
        description: "The phone number format is invalid",
        variant: "destructive"
      });
      return;
    }
    
    // WhatsApp API URL format
    window.open(`https://wa.me/${formattedNumber}`, '_blank');
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button 
        onClick={handleCall}
        variant="ghost"
        size="icon"
        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        title="Call"
      >
        <PhoneCall className="h-3.5 w-3.5" />
      </Button>
      <Button 
        onClick={handleWhatsApp}
        variant="ghost"
        size="icon"
        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
        title="WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default ContactButtons;
