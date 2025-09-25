
import React from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface PricingToggleProps {
  value: 'monthly' | 'annual';
  onChange: (value: 'monthly' | 'annual') => void;
}

const PricingToggle = ({ value, onChange }: PricingToggleProps) => {
  return (
    <div className="flex flex-col items-center space-y-3 mb-10">
      <div className="text-sm text-gray-800">Choose your billing cycle</div>
      <ToggleGroup 
        type="single" 
        value={value} 
        onValueChange={(val) => val && onChange(val as 'monthly' | 'annual')}
        className="border rounded-lg p-1"
      >
        <ToggleGroupItem value="monthly" className="px-6">Monthly</ToggleGroupItem>
        <ToggleGroupItem value="annual" className="px-6">
          Annual
          <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">Save up to 20%</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

export default PricingToggle;
