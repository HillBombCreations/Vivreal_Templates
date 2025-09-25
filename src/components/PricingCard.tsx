
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Check, Users, Database, Mail, InfinityIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PricingPlan } from "@/data/pricing";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  plan: PricingPlan;
  isAnnual?: boolean;
}

const PricingCard = ({ plan, isAnnual = true }: PricingCardProps) => {
  const isPopular = plan.popular;
  const isEnterprise = plan.key === 'enterprise';
  const colorClasses = {
    "blue-700": "blue-700",
    "purple-700": "purple-700",
    "red-700": "red-700",
    "green-700": "green-700",
    "yellow-700": "yellow-700"
  };
  return (
    <Card 
      className={cn(
        "flex flex-col transition-all duration-200 animate-fade-in-up hover-lift",
        isPopular && "border-primary shadow-md relative"
      )}
      style={{ animationDelay: `${parseInt(plan.key) * 100}ms` }}
    >
      {isPopular && (
        <Badge 
          className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-primary"
        >
          Most Popular
        </Badge>
      )}
      <CardHeader className="pb-8 pt-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold">{plan.name}</h2>
          <div className="font-display">
            <span className={`text-4xl font-bold text-${colorClasses[plan.color]}`}>{plan.price}</span>
            {!isEnterprise && <span className="text-gray-800 ml-1 text-sm">/month</span>}
          </div>
          {isAnnual && plan.savings && (
            <div className="text-sm text-gray-800 font-medium mt-1">
              Save {plan.savings} per year
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow pb-8">
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              <Users size={20} className="text-gray-800" />
            </div>
            <div>
              <p className="text-sm font-medium">{plan.features.userSeats}</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              <Database size={20} className="text-gray-800" />
            </div>
            <div>
              <p className="text-sm font-medium">{plan.features.storageLimit}</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              {plan.key === 'enterprise' ? (
                <InfinityIcon size={20} className="text-gray-800" />
              ) : (
                <Check size={20} className="text-gray-800" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{plan.features.integrationCount}</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              <Mail size={20} className="text-gray-800" />
            </div>
            <div>
              <p className="text-sm font-medium">{plan.features.supportType}</p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4 pb-6">
        <Button
          asChild
          className={`w-full bg-${colorClasses[plan.color]}`}
          variant={isEnterprise ? "outline" : "default"}
        >
          {isEnterprise ? (
            <a href='mailto:hello@vivreal.io'>Contact Sales</a>
          ) : (
            <a href='https://app.vivreal.io/register/'>Create Your Free Account</a>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PricingCard;
