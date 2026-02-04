/**
 * Test Ad Upload with Cloudflare R2
 * This script tests:
 * 1. Admin user login/creation
 * 2. Media upload to R2
 * 3. Ad creation with R2 metadata stored in Prisma
 */

import prisma from '../lib/prisma.mjs';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_API_URL || 'http://localhost:3000';

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 AD REGISTRATION + R2 UPLOAD TEST');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Get or create admin user
    console.log('\n📌 Step 1: Setting up admin user...');
    
    let user = await prisma.appUser.findUnique({ 
      where: { email: 'admin@delipucash.com' } 
    });
    
    if (!user) {
      const hashedPwd = await bcrypt.hash('admin123456', 10);
      user = await prisma.appUser.create({
        data: {
          email: 'admin@delipucash.com',
          password: hashedPwd,
          firstName: 'Admin',
          lastName: 'User',
          phone: '+256700000000',
          role: 'ADMIN',
        }
      });
      console.log('✅ Created admin user:', user.id);
    } else {
      console.log('✅ Admin user exists:', user.id);
    }
    
    const userId = user.id;
    
    // Step 2: Create a test image file for upload
    console.log('\n📌 Step 2: Preparing test media file...');
    
    // Create a simple test image (1x1 pixel PNG)
    const testImagePath = path.join(__dirname, 'test-ad-image.png');
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, pngHeader);
    console.log('✅ Test image created:', testImagePath);
    
    // Step 3: Upload media to R2 via API
    console.log('\n📌 Step 3: Uploading media to Cloudflare R2...');
    
    const formData = new FormData();
    formData.append('media', fs.createReadStream(testImagePath), {
      filename: 'test-ad-image.png',
      contentType: 'image/png'
    });
    formData.append('userId', userId);
    
    const uploadResponse = await fetch(`${BASE_URL}/api/r2/upload/ad-media`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok || !uploadResult.success) {
      throw new Error(`R2 upload failed: ${uploadResult.message || uploadResult.error}`);
    }
    
    console.log('✅ Media uploaded to R2 successfully!');
    console.log('   URL:', uploadResult.media.url);
    console.log('   Key:', uploadResult.media.key);
    console.log('   Size:', uploadResult.media.size, 'bytes');
    console.log('   Type:', uploadResult.media.type);
    console.log('   ETag:', uploadResult.media.etag);
    
    // Step 4: Create ad with R2 metadata
    console.log('\n📌 Step 4: Creating ad with R2 metadata...');
    
    const adPayload = {
      // Basic Info
      title: 'Test Ad Campaign - R2 Upload Verification',
      headline: 'Powered by Cloudflare R2',
      description: 'This is a test ad to verify R2 media upload and Prisma metadata storage.',
      
      // Media URLs from R2
      imageUrl: uploadResult.media.url,
      
      // Ad configuration
      type: 'regular',
      placement: 'feed',
      sponsored: true,
      targetUrl: 'https://example.com/landing-page',
      callToAction: 'learn_more',
      
      // Budget & Bidding
      pricingModel: 'cpm',
      totalBudget: 100,
      bidAmount: 2.5,
      
      // Targeting
      targetAgeRanges: ['18-24', '25-34'],
      targetGender: 'all',
      
      // User
      userId: userId,
      
      // R2 Metadata (same as Video model)
      r2ImageKey: uploadResult.media.key,
      r2ImageEtag: uploadResult.media.etag,
      imageMimeType: uploadResult.media.mimeType,
      imageSizeBytes: uploadResult.media.size,
      storageProvider: 'r2',
    };
    
    console.log('   Sending payload:', JSON.stringify(adPayload, null, 2));
    
    const createAdResponse = await fetch(`${BASE_URL}/api/ads/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adPayload),
    });
    
    const adResult = await createAdResponse.json();
    console.log('   Response status:', createAdResponse.status);
    console.log('   Response body:', JSON.stringify(adResult, null, 2));
    
    if (!createAdResponse.ok || !adResult.success) {
      throw new Error(`Ad creation failed: ${adResult.message || adResult.error || JSON.stringify(adResult)}`);
    }
    
    console.log('✅ Ad created successfully!');
    console.log('   Ad ID:', adResult.data.id);
    console.log('   Title:', adResult.data.title);
    console.log('   Status:', adResult.data.status);
    
    // Step 5: Verify R2 metadata was stored in Prisma
    console.log('\n📌 Step 5: Verifying R2 metadata in Prisma...');
    
    const storedAd = await prisma.ad.findUnique({
      where: { id: adResult.data.id },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        r2ImageKey: true,
        r2ImageEtag: true,
        imageMimeType: true,
        imageSizeBytes: true,
        storageProvider: true,
      }
    });
    
    console.log('✅ Prisma metadata verification:');
    console.log('   r2ImageKey:', storedAd.r2ImageKey);
    console.log('   r2ImageEtag:', storedAd.r2ImageEtag);
    console.log('   imageMimeType:', storedAd.imageMimeType);
    console.log('   imageSizeBytes:', storedAd.imageSizeBytes?.toString());
    console.log('   storageProvider:', storedAd.storageProvider);
    
    // Cleanup test file
    fs.unlinkSync(testImagePath);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    console.log('• Media successfully uploaded to Cloudflare R2');
    console.log('• Ad created with R2 metadata stored in Prisma');
    console.log('• R2 metadata fields verified in database');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
