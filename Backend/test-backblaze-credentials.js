require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { S3Client, ListBucketsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET_NAME = process.env.B2_BUCKET_NAME;
const B2_ENDPOINT = process.env.B2_ENDPOINT;
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_REGION = process.env.B2_REGION || 'us-west-002';

console.log('\n🔍 Testing Backblaze B2 Credentials...\n');
console.log('Configuration:');
console.log('  BUCKET_NAME:', BUCKET_NAME || '❌ NOT SET');
console.log('  B2_ENDPOINT:', B2_ENDPOINT || '❌ NOT SET');
console.log('  B2_KEY_ID:', B2_KEY_ID ? `${B2_KEY_ID.substring(0, 10)}...` : '❌ NOT SET');
console.log('  B2_APP_KEY:', B2_APP_KEY ? `${B2_APP_KEY.substring(0, 10)}...` : '❌ NOT SET');
console.log('  B2_REGION:', B2_REGION);
console.log('\n');

if (!BUCKET_NAME || !B2_ENDPOINT || !B2_KEY_ID || !B2_APP_KEY) {
  console.error('❌ Missing required environment variables!');
  console.error('Please check your .env file in the Backend directory.');
  process.exit(1);
}

const s3Client = new S3Client({
  region: B2_REGION,
  endpoint: B2_ENDPOINT,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
  forcePathStyle: true,
});

async function testCredentials() {
  try {
    console.log('📋 Step 1: Testing bucket access...');
    
    try {
      const listCommand = new ListBucketsCommand({});
      const listResponse = await s3Client.send(listCommand);
      
      console.log('✅ ListBuckets successful!');
      console.log('   Available buckets:');
      if (listResponse.Buckets && listResponse.Buckets.length > 0) {
        listResponse.Buckets.forEach(bucket => {
          const isTargetBucket = bucket.Name === BUCKET_NAME;
          console.log(`   ${isTargetBucket ? '✓' : ' '} ${bucket.Name}${isTargetBucket ? ' (TARGET)' : ''}`);
        });
      }
      
      const targetBucketExists = listResponse.Buckets?.some(b => b.Name === BUCKET_NAME);
      if (!targetBucketExists) {
        console.log(`\n⚠️  Warning: Target bucket "${BUCKET_NAME}" not found in your account!`);
        console.log('   Please verify the bucket name in your .env file.');
      }
    } catch (listError) {
      if (listError.message.includes('not entitled') || listError.message.includes('AccessDenied')) {
        console.log('⚠️  ListBuckets not available (key may be bucket-scoped)');
        console.log('   This is OK - proceeding to test direct bucket access...');
      } else {
        throw listError;
      }
    }
    
    console.log('\n📤 Step 2: Testing PutObject (upload test file)...');
    const testKey = `test/credentials-test-${Date.now()}.txt`;
    const testContent = Buffer.from('This is a test file to verify Backblaze credentials are working correctly.');
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });
    
    await s3Client.send(putCommand);
    console.log('✅ PutObject successful!');
    console.log(`   Test file uploaded to: ${testKey}`);
    
    console.log('\n🎉 All tests passed! Your Backblaze credentials are valid and working.');
    console.log('\n✅ You can now use the direct upload method.');
    
  } catch (error) {
    console.error('\n❌ Credential test failed!');
    console.error('\nError details:');
    console.error('  Code:', error.Code || error.name);
    console.error('  Message:', error.message);
    
    if (error.message.includes('InvalidAccessKeyId')) {
      console.error('\n💡 Solution:');
      console.error('   1. Go to Backblaze B2 → App Keys');
      console.error('   2. Verify your Key ID and Application Key are correct');
      console.error('   3. Make sure the key is active and has the right permissions');
      console.error('   4. If needed, create a new Application Key with:');
      console.error('      - Access to bucket:', BUCKET_NAME);
      console.error('      - Capabilities: listBuckets, readFiles, writeFiles, deleteFiles');
    } else if (error.message.includes('NoSuchBucket')) {
      console.error('\n💡 Solution:');
      console.error(`   The bucket "${BUCKET_NAME}" does not exist.`);
      console.error('   1. Go to Backblaze B2 → Buckets');
      console.error(`   2. Create a bucket named "${BUCKET_NAME}"`);
      console.error('   3. Or update B2_BUCKET_NAME in your .env file');
    } else     if (error.message.includes('AccessDenied') || error.message.includes('not entitled')) {
      console.error('\n💡 Solution:');
      console.error('   Your Application Key does not have the required permissions.');
      console.error('\n   Required Capabilities:');
      console.error('   ✓ listBuckets - to list and verify buckets');
      console.error('   ✓ readFiles - to read files from bucket');
      console.error('   ✓ writeFiles - to upload files to bucket');
      console.error('   ✓ deleteFiles - to delete files (optional)');
      console.error('\n   Steps to fix:');
      console.error('   1. Go to https://secure.backblaze.com/user_signin.htm');
      console.error('   2. Navigate to: B2 Cloud Storage → App Keys');
      console.error('   3. Find your key ID:', B2_KEY_ID);
      console.error('   4. Click "Edit" or create a NEW Application Key');
      console.error('   5. Ensure it has access to bucket:', BUCKET_NAME);
      console.error('   6. Select ALL capabilities (especially listBuckets and writeFiles)');
      console.error('   7. Copy the new Key ID and Application Key');
      console.error('   8. Update your .env file with the new credentials');
      console.error('   9. Restart your server and run this test again');
    }
    
    process.exit(1);
  }
}

testCredentials();

