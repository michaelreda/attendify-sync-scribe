
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
    <div className="flex space-x-2 mt-1">
      <Button 
        onClick={handleCall}
        variant="outline"
        size="sm"
        className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700"
      >
        <PhoneCall className="h-3.5 w-3.5 mr-1" />
        Call
      </Button>
      <Button 
        onClick={handleWhatsApp}
        variant="outline"
        size="sm"
        className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:text-green-700"
      >
        <MessageCircle className="h-3.5 w-3.5 mr-1" />
        WhatsApp
      </Button>
    </div>
  );
};

export default ContactButtons;
