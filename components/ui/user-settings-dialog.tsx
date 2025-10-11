"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, BarChart3, CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { UsageSettings } from "@/components/settings/usage-settings";
import { PaymentChannelSettings } from "@/components/settings/payment-channel-settings";
import { RechargeSettings } from "@/components/settings/recharge-settings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "profile" | "usage" | "billing" | "recharge";
}

export const UserSettingsDialog: React.FC<UserSettingsDialogProps> = ({
  open,
  onOpenChange,
  defaultTab = "profile",
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Update activeTab when defaultTab changes
  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, open]);

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "usage", label: "Usage", icon: BarChart3 },
    { id: "billing", label: "Payment Channel", icon: CreditCard },
    { id: "recharge", label: "Recharge", icon: Wallet },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSettings />;
      case "usage":
        return <UsageSettings />;
      case "billing":
        return <PaymentChannelSettings />;
      case "recharge":
        return <RechargeSettings onNavigateToChannels={() => setActiveTab("billing")} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[600px] w-[1200px] max-w-[1200px] overflow-hidden p-0"
        style={{ width: "1200px", maxWidth: "1200px" }}
      >
        <div className="flex h-full w-full">
          {/* Left Sidebar */}
          <div className="w-56 flex-shrink-0 border-r bg-muted/30 p-4">
            <DialogHeader className="mb-6">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>

            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      activeTab === tab.id &&
                        "bg-primary text-primary-foreground",
                    )}
                    onClick={() =>
                      setActiveTab(tab.id as "profile" | "usage" | "billing" | "recharge")
                    }
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Right Content */}
          <div className="min-w-0 flex-1 overflow-auto">{renderContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
