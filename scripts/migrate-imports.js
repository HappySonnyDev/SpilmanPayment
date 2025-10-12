const fs = require('fs');
const path = require('path');

// Import path migration mapping
const importMigrations = {
  // lib/shared (前后端共享)
  '@/lib/ckb': '@/lib/shared/ckb',
  '@/lib/date-utils': '@/lib/shared/date-utils',
  '@/lib/utils': '@/lib/shared/utils',
  
  // lib/server (纯后端)
  '@/lib/auth': '@/lib/server/auth',
  '@/lib/database': '@/lib/server/database',
  '@/lib/cron-manager': '@/lib/server/cron-manager',
  '@/lib/api-middleware': '@/lib/server/api-middleware',
  '@/lib/auth-middleware': '@/lib/server/auth-middleware',
  
  // lib/client (纯前端)
  '@/lib/api': '@/lib/client/api',
  '@/lib/auth-client': '@/lib/client/auth-client',
  '@/lib/fetch': '@/lib/client/fetch',
  '@/lib/token-tracker': '@/lib/client/token-tracker',
  '@/lib/auth-aware-transport': '@/lib/client/auth-aware-transport',
  '@/lib/chunk-payment-integration': '@/lib/client/chunk-payment-integration',
  
  // components
  '@/components/assistant-ui/': '@/features/assistant/components/',
  '@/components/admin/': '@/features/admin/components/',
  '@/components/auth/': '@/features/auth/components/',
  '@/components/settings/': '@/features/settings/components/',
  '@/components/bussiness/user-dropdown': '@/components/shared/user-dropdown',
  '@/components/bussiness/info-card': '@/components/shared/info-card',
  '@/components/bussiness/data-display': '@/components/shared/data-display',
  '@/components/bussiness/selection-group': '@/components/shared/selection-group',
  '@/components/bussiness/create-payment-channel': '@/features/payment/components/create-payment-channel',
  '@/components/bussiness/payment-now': '@/features/payment/components/payment-now',
  '@/components/bussiness/payment-summary': '@/features/payment/components/payment-summary',
  
  // hooks
  '@/hooks/use-chunk-payment': '@/features/assistant/hooks/use-chunk-payment',
  '@/hooks/use-payment-channels': '@/features/payment/hooks/use-payment-channels',
  '@/hooks/use-payment-transaction': '@/features/payment/hooks/use-payment-transaction',
  
  // context
  '@/app/context/auth-context': '@/features/auth/components/auth-context',
};

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function migrateImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply each migration
  for (const [oldPath, newPath] of Object.entries(importMigrations)) {
    const patterns = [
      // from "..."
      new RegExp(`from ['"]${oldPath.replace(/\//g, '\\/')}(['"])`, 'g'),
      // import("...")
      new RegExp(`import\\(['"]${oldPath.replace(/\//g, '\\/')}(['"])`, 'g'),
      // require("...")
      new RegExp(`require\\(['"]${oldPath.replace(/\//g, '\\/')}(['"])`, 'g'),
    ];
    
    patterns.forEach(pattern => {
      const newContent = content.replace(pattern, (match, quote) => {
        return match.replace(oldPath, newPath);
      });
      
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

// Main execution
const projectRoot = path.join(__dirname, '..');
const files = getAllFiles(projectRoot);

console.log(`\nFound ${files.length} files to process...\n`);

let updatedCount = 0;
files.forEach(file => {
  if (migrateImportsInFile(file)) {
    updatedCount++;
  }
});

console.log(`\n✅ Migration complete! Updated ${updatedCount} files.`);
