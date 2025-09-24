/**
 * Example of how to use PublicKeyContainer.useContainer() directly in any component
 *
 * This is the recommended approach instead of creating wrapper hooks
 */

"use client";

import React from "react";
import PublicKeyContainer from '../hooks/public-key-state'
;

export const ExamplePublicKeyUsage: React.FC = () => {
  // Direct usage of the container - no wrapper hooks needed
  const { publicKey, updatePublicKey } = PublicKeyContainer.useContainer();

  return (
    <div className="rounded border p-4">
      <h3 className="mb-2 font-semibold">Example Public Key Usage</h3>

      {publicKey ? (
        <div>
          <p className="text-sm text-gray-600">Current Public Key:</p>
          <p className="rounded bg-gray-100 p-2 font-mono text-xs break-all">
            {publicKey}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No public key available</p>
      )}

      <button
        onClick={() => updatePublicKey("example-key-" + Date.now())}
        className="mt-2 rounded bg-blue-500 px-3 py-1 text-sm text-white"
      >
        Update Key (Demo)
      </button>
    </div>
  );
};
