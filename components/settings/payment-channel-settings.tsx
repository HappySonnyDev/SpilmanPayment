"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserInfo } from "@/lib/user-info-context";
import { ccc, hexFrom, WitnessArgs } from "@ckb-ccc/core";
import { DEVNET_SCRIPTS, buildClient, generateCkbSecp256k1Signature, generateCkbSecp256k1SignatureWithSince, createWitnessData, getMessageHashFromTx } from "@/lib/ckb";
import { executePayNow } from "@/lib/payment-utils";
import { ChevronDown } from "lucide-react";


interface PaymentChannel {
  id: number;
  channelId: string;
  amount: number;
  durationDays: number;
  durationSeconds?: number; // Add optional seconds field
  status: number;
  statusText: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string; // Add verifiedAt field
  // Raw database fields for data extraction
  sellerSignature: string | null;
  refundTxData: string | null;
  fundingTxData: string | null;
}

export const PaymentChannelSettings: React.FC = () => {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const { userInfo } = useUserInfo();

  // Extract transaction information from refund transaction data
  const extractRefundTxInfo = (refundTxData: string | null) => {
    if (!refundTxData) {
      return {
        inputTxHash: "N/A",
        buyerAddress: userInfo?.publicKey || "N/A",
      };
    }

    try {
      const refundTx = JSON.parse(refundTxData);
      
      // Get input transaction hash from first input
      const inputTxHash = refundTx.inputs?.[0]?.previousOutput?.txHash || "N/A";
      
      // Get buyer address from first output lock script
      let buyerAddress = "N/A";
      if (refundTx.outputs?.[0]?.lock) {
        try {
          const lockScript = refundTx.outputs[0].lock;
          // Create a mock client for address conversion
          const cccClient = new ccc.ClientPublicTestnet({
            url: "http://localhost:28114",
            scripts: DEVNET_SCRIPTS,
          });
          const address = ccc.Address.fromScript(
            lockScript as ccc.Script,
            cccClient,
          ).toString();
          buyerAddress = address;
        } catch (addressError) {
          console.error(
            "Error converting lock script to address:",
            addressError,
          );
          // Fallback to lock args or user public key
          buyerAddress =
            refundTx.outputs[0].lock.args || userInfo?.publicKey || "N/A";
        }
      } else {
        buyerAddress = userInfo?.publicKey || "N/A";
      }

      return {
        inputTxHash,
        buyerAddress,
      };
    } catch (error) {
      console.error("Error parsing refund transaction:", error);
      return {
        inputTxHash: "N/A",
        buyerAddress: userInfo?.publicKey || "N/A",
      };
    }
  };

  // Fetch payment channels on component mount
  useEffect(() => {
    fetchPaymentChannels();
  }, []);

  const fetchPaymentChannels = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/channel/list');
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment channels');
      }
      
      const result = await response.json();
      setChannels(result.data.channels);
    } catch (error) {
      console.error('Error fetching payment channels:', error);
      alert('Failed to load payment channels');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChannelExpansion = (channelId: string) => {
    const newExpanded = new Set(expandedChannels);
    if (newExpanded.has(channelId)) {
      newExpanded.delete(channelId);
    } else {
      newExpanded.add(channelId);
    }
    setExpandedChannels(newExpanded);
  };

  const handlePayNow = async (channel: PaymentChannel) => {
    try {
      setActionLoading(channel.channelId);
      
      // Check if funding transaction data exists
      if (!channel.fundingTxData) {
        alert("No funding transaction data available for this channel.");
        return;
      }

      // Use the shared payment utility
      const result = await executePayNow({
        channelId: channel.channelId,
        fundingTx: JSON.parse(channel.fundingTxData),
        amount: channel.amount,
      });

      if (result.success) {
        alert(
          `Payment successful and channel activated!\n` +
          `Transaction Hash: ${result.txHash}\n` +
          `Channel Status: ${result.channelStatus}`
        );
        
        // Refresh the channels list to show updated status
        await fetchPaymentChannels();
      } else {
        alert(result.error);
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleChannelAction = async (channelId: string, action: 'activate' | 'settle') => {
    try {
      setActionLoading(channelId);
      
      if (action === 'settle') {
        // Call the settlement API
        const response = await fetch('/api/channel/settle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to settle channel');
        }
        
        const result = await response.json();
        alert(
          `Channel settled successfully!\n` +
          `Transaction Hash: ${result.txHash}\n` +
          `Channel Status: ${result.channelStatus}`
        );
        
        // Refresh the channels list
        await fetchPaymentChannels();
      }
      
    } catch (error) {
      console.error(`Error ${action}ing channel:`, error);
      alert(`Failed to ${action} channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (channelId: string) => {
    try {
      setActionLoading(channelId);
      
      const response = await fetch('/api/channel/set-default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set as default');
      }
      
      const result = await response.json();
      alert(`Channel set as default successfully!`);
      
      // Refresh the channels list
      await fetchPaymentChannels();
    } catch (error) {
      console.error('Error setting default channel:', error);
      alert('Failed to set as default: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdrawDeposit = async (channel: PaymentChannel) => {
    try {
      setActionLoading(channel.channelId);
      
      // Check if refund transaction data and seller signature exist
      if (!channel.refundTxData || !channel.sellerSignature) {
        alert("No refund transaction data or seller signature available for this channel.");
        return;
      }

      // Get buyer private key from localStorage
      const buyerPrivateKey = localStorage.getItem("private_key");
      if (!buyerPrivateKey) {
        alert("Please connect your CKB wallet first in Payment Channel settings.");
        return;
      }

      // Parse the refund transaction (already includes fees from creation time)
      const refundTxData = JSON.parse(channel.refundTxData);
      const refundTx = ccc.Transaction.from(refundTxData);
      
      console.log('Using pre-calculated refund transaction:', refundTx);
      
      // Get transaction hash for signing
      const transactionHash = refundTx.hash();
      
      // Generate message hash from completed refund transaction
      const messageHash = getMessageHashFromTx(transactionHash);
      
      // Generate buyer signature with timelock (since this is a refund transaction)
      // Use the same duration that was used during channel creation
      const durationInSeconds = channel.durationSeconds || (channel.durationDays * 24 * 60 * 60);
      
      const sinceValue = ccc.numFromBytes(
        new Uint8Array([
          0x80,
          0x00,
          0x00,
          0x00, // Relative time lock flag
          0x00,
          0x00,
          0x00,
          0x00,
        ]),
      ) + BigInt(durationInSeconds);
      
      console.log(`Generating buyer signature with since value: ${sinceValue}`);
      console.log(`Duration in seconds: ${durationInSeconds}`);
      
      const buyerSignatureBytes = generateCkbSecp256k1SignatureWithSince(
        buyerPrivateKey,
        messageHash,
        sinceValue,
      );
      
      // Convert seller signature from hex to bytes
      const sellerSignatureHex = channel.sellerSignature.startsWith('0x') 
        ? channel.sellerSignature.slice(2) 
        : channel.sellerSignature;
      
      if (sellerSignatureHex.length !== 130) {
        throw new Error(`Invalid seller signature length: ${sellerSignatureHex.length}, expected 130`);
      }
      
      const sellerSignatureBytes = new Uint8Array(
        sellerSignatureHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
      );
      
      // Validate signature lengths
      if (buyerSignatureBytes.length !== 65) {
        throw new Error(`Invalid buyer signature length: ${buyerSignatureBytes.length}, expected 65`);
      }
      if (sellerSignatureBytes.length !== 65) {
        throw new Error(`Invalid seller signature length: ${sellerSignatureBytes.length}, expected 65`);
      }

      // Create witness data with both signatures (buyer first, seller second)
      const witnessData = createWitnessData(
        buyerSignatureBytes,
        sellerSignatureBytes,
      );

      // Update the transaction witnesses
      const witnessArgs = new WitnessArgs(hexFrom(witnessData));
      refundTx.witnesses[0] = hexFrom(witnessArgs.toBytes());
      
      // Submit the transaction to CKB network
      const client = buildClient("devnet");
      console.log('Submitting refund transaction with multi-sig:', refundTx);
      
      const txHash = await client.sendTransaction(refundTx);
      
      alert(
        `Deposit withdrawn successfully!\n` +
        `Transaction Hash: ${txHash}\n` +
        `You can check the transaction status on CKB Explorer.`
      );
      
      // Refresh the channels list
      await fetchPaymentChannels();
      
    } catch (error) {
      console.error('Deposit withdrawal error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to withdraw deposit: ';
      if (error instanceof Error) {
        if (error.message.includes('time')) {
          errorMessage += 'Channel timelock may not have expired yet. Please wait for the timelock period to complete.';
        } else if (error.message.includes('signature')) {
          errorMessage += 'Signature validation failed. Please check your private key and seller signature.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error';
      }
      
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: number, statusText: string) => {
    const baseClasses = "inline-flex rounded-full px-3 py-1 text-xs font-medium";
    
    switch (status) {
      case 1: // Inactive
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`}>
            {statusText}
          </span>
        );
      case 2: // Active
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`}>
            {statusText}
          </span>
        );
      case 3: // Invalid
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`}>
            {statusText}
          </span>
        );
      case 4: // Settled
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`}>
            {statusText}
          </span>
        );
      case 5: // Expired
        return (
          <span className={`${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400`}>
            {statusText}
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400`}>
            {statusText}
          </span>
        );
    }
  };

  // Helper function to calculate period range
  const formatDuration = (durationDays: number, durationSeconds?: number) => {
    // If we have duration in seconds, use that; otherwise fall back to days
    if (durationSeconds !== undefined && durationSeconds !== null) {
      if (durationSeconds < 60) {
        return `${durationSeconds}s`;
      } else if (durationSeconds < 3600) {
        return `${Math.floor(durationSeconds / 60)}m`;
      } else if (durationSeconds < 86400) {
        return `${Math.floor(durationSeconds / 3600)}h`;
      } else {
        const days = Math.floor(durationSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''}`;
      }
    }
    // Fallback to days format
    return `${durationDays} day${durationDays > 1 ? 's' : ''}`;
  };

  const getPeriodRange = (createdAt: string, verifiedAt: string | undefined, durationDays: number, durationSeconds?: number) => {
    // Use verifiedAt for active channels, createdAt for inactive channels
    const startDate = new Date(verifiedAt && verifiedAt !== null ? verifiedAt : createdAt);
    // Use duration in seconds if available, otherwise convert days to seconds
    const durationInSeconds = durationSeconds || (durationDays * 24 * 60 * 60);
    const endDate = new Date(startDate.getTime() + (durationInSeconds * 1000));
    
    const formatDateTime = (date: Date) => {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai' // UTC+8
      });
    };
    
    return `${formatDateTime(startDate)} - ${formatDateTime(endDate)}`;
  };

  const getActionButton = (channel: PaymentChannel) => {
    const isLoading = actionLoading === channel.channelId;
    
    if (channel.status === 1) { // Inactive - Show PayNow
      return (
        <Button
          onClick={() => handlePayNow(channel)}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
          size="sm"
        >
          {isLoading ? 'Processing...' : 'Pay Now'}
        </Button>
      );
    } else if (channel.status === 2) { // Active - Show Manage dropdown
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
              size="sm"
            >
              {isLoading ? 'Processing...' : (
                <>
                  Manage
                  <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleSetDefault(channel.channelId)}
              disabled={isLoading || channel.isDefault}
            >
              {channel.isDefault ? '✓ Already Default' : 'Set as Default'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleChannelAction(channel.channelId, 'settle')}
              disabled={isLoading}
              className="text-red-600 focus:text-red-600"
            >
              Settle Channel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else if (channel.status === 5) { // Expired - Show Withdraw Deposit
      return (
        <Button
          onClick={() => handleWithdrawDeposit(channel)}
          disabled={isLoading}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm"
          size="sm"
        >
          {isLoading ? 'Processing...' : 'Withdraw Deposit'}
        </Button>
      );
    } else { // Invalid or Settled - No actions available
      return (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {/* No actions available */}
        </span>
      );
    }
  };

  return (
    <TooltipProvider>
      <div className="w-full max-w-none h-[600px] overflow-y-scroll p-8">
      <h3 className="mb-6 text-lg font-semibold">Payment Channels</h3>
      
      {isLoading ? (
        <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
          <div className="p-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Loading payment channels...
            </p>
          </div>
        </div>
      ) : channels.length === 0 ? (
        <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
          <div className="p-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No payment channels found. Create your first payment channel using the Recharge tab.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => (
            <div key={channel.id} className={`rounded-lg border shadow-sm ${
              channel.isDefault 
                ? 'border-blue-200 bg-blue-50/50 dark:border-blue-700/40 dark:bg-blue-900/20' 
                : 'border-gray-100/30 bg-slate-50/50 dark:border-slate-700/40 dark:bg-slate-800'
            }`}>
              {/* Accordion Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleChannelExpansion(channel.channelId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          ...{channel.channelId.slice(-6)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-mono text-xs">{channel.channelId}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {channel.amount.toLocaleString()} CKB
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {getPeriodRange(channel.createdAt, channel.verifiedAt, channel.durationDays, channel.durationSeconds)}
                    </div>
                    <div>
                      {getStatusBadge(channel.status, channel.statusText)}
                    </div>
                    {channel.isDefault && (
                      <div className="inline-flex rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Default
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {getActionButton(channel)}
                    <div className="text-slate-400 dark:text-slate-500">
                      {expandedChannels.has(channel.channelId) ? '▼' : '▶'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Accordion Content */}
              {expandedChannels.has(channel.channelId) && (
                <div className="border-t border-gray-200 dark:border-slate-700 p-6 bg-white dark:bg-slate-900">
                  {/* Commented out for now to reduce content density */}
                  {/*
                  <div className="space-y-6">
                    {/* Product Information */}
                    {/*
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Product Information
                      </h4>
                      <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            Amount
                          </label>
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300">
                            {channel.amount.toLocaleString()} CKB
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            Tokens
                          </label>
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300">
                            {(channel.amount * 0.01).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            Duration
                          </label>
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300">
                            {channel.durationDays} day{channel.durationDays > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                    */}
                    
                    {/* Channel Information */}
                    {/*
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Channel Information
                      </h4>
                      <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            Channel ID
                          </label>
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                            {channel.channelId}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            Period
                          </label>
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300">
                            {getPeriodRange(channel.createdAt, channel.verifiedAt, channel.durationDays, channel.durationSeconds)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            Status
                          </label>
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-xs">
                            {getStatusBadge(channel.status, channel.statusText)}
                          </div>
                        </div>
                      </div>
                    </div>
                    */}
                  {/*
                  </div>
                  */}
                  
                  {/* Deposit Information */}
                  <div className="">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Deposit Information
                    </h4>
                    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                          Input Transaction Hash
                        </label>
                        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                          {extractRefundTxInfo(channel.refundTxData).inputTxHash}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                          Buyer Wallet Address
                        </label>
                        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                          {extractRefundTxInfo(channel.refundTxData).buyerAddress}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seller Signature */}
                  <div className="mt-6">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Seller Signature
                    </h4>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg font-mono text-xs break-all text-slate-700 dark:text-slate-300">
                        {channel.sellerSignature || "No signature available"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}  
      </div>
    </TooltipProvider>
  );
};
