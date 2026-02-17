#!/usr/bin/env node
/**
 * Quick script to seed comprehensive ad data covering all placements & types.
 *
 * Authenticates as admin, creates 20 ads via the REST API, then auto-approves
 * each one so they appear in the public feed (status: 'approved').
 *
 * Run: node scripts/seed-ads-only.mjs
 */

const BASE_URL = process.env.API_BASE_URL || 'https://delipucash-latest.vercel.app/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@delipucash.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// High-quality images (Unsplash)
const IMG = {
  finance:    'https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=800&h=400&fit=crop',
  banking:    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=400&fit=crop',
  crypto:     'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=400&fit=crop',
  smartphone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&h=400&fit=crop',
  laptop:     'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=400&fit=crop',
  fitness:    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=400&fit=crop',
  food:       'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop',
  travel:     'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=400&fit=crop',
  education:  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop',
  fashion:    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=400&fit=crop',
  music:      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=400&fit=crop',
  gaming:     'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&h=400&fit=crop',
  coffee:     'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=400&fit=crop',
  business:   'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
  coding:     'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
  sneakers:   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=400&fit=crop',
  hotel:      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=400&fit=crop',
  yoga:       'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=400&fit=crop',
  car:        'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=400&fit=crop',
  home:       'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop',
};

const VID = {
  blazes:   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  fun:      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  escapes:  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  joyrides: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
};

// 20 ads covering ALL 7 frontend placements and ALL 4 backend ad types
const ads = [
  // -- home (2) --
  { title: "Premium Subscription — 50% Off!", headline: "Unlock Premium Features Today", description: "Upgrade to premium and unlock all features at half price. Ad-free experience, priority support, and exclusive rewards.", imageUrl: IMG.finance, videoUrl: VID.blazes, thumbnailUrl: IMG.finance, type: "featured", placement: "home", callToAction: "get_offer", pricingModel: "cpm", totalBudget: 10000, bidAmount: 2.5, dailyBudgetLimit: 400, priority: 10, frequency: 5, targetUrl: "https://example.com/premium", targetAgeRanges: ["18-24","25-34"], targetGender: "all", targetLocations: ["Uganda","Kenya","Tanzania"], targetInterests: ["technology","finance","earning"], enableRetargeting: true },
  { title: "Mobile Money Made Easy", headline: "Send & Receive Instantly", description: "Transfer money to anyone in Uganda instantly. Zero fees on your first 10 transactions. Trusted by 2M+ users.", imageUrl: IMG.smartphone, thumbnailUrl: IMG.smartphone, type: "banner", placement: "home", callToAction: "sign_up", pricingModel: "cpc", totalBudget: 5000, bidAmount: 1.2, dailyBudgetLimit: 200, priority: 8, frequency: 4, targetUrl: "https://example.com/mobile-money", targetAgeRanges: ["18-24","25-34","35-44"], targetGender: "all", targetLocations: ["Uganda"], targetInterests: ["finance","mobile","payments"], enableRetargeting: false },

  // -- feed (3) --
  { title: "Earn While You Learn — Free Courses", headline: "Start Your Tech Career", description: "Master Python, JavaScript, and React with our free certified courses. Earn UGX 5,000 per completed module.", imageUrl: IMG.coding, thumbnailUrl: IMG.coding, type: "regular", placement: "feed", callToAction: "learn_more", pricingModel: "cpc", totalBudget: 8000, bidAmount: 0.6, dailyBudgetLimit: 300, priority: 7, frequency: 5, targetUrl: "https://example.com/learn-earn", targetAgeRanges: ["18-24","25-34"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["education","technology","career"], enableRetargeting: true },
  { title: "Food Delivery — 50% Off First Order", headline: "Hungry? Order Now", description: "Fresh meals delivered to your door in 30 minutes. Use code WELCOME50 for 50% off your first order!", imageUrl: IMG.food, thumbnailUrl: IMG.food, type: "banner", placement: "feed", callToAction: "get_offer", pricingModel: "cpc", totalBudget: 6000, bidAmount: 0.75, dailyBudgetLimit: 250, priority: 8, frequency: 5, targetUrl: "https://example.com/food-delivery", targetAgeRanges: ["18-24","25-34","35-44"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["food","delivery","restaurants"], enableRetargeting: true },
  { title: "Crypto Trading Made Easy", headline: "Start with UGX 10,000", description: "Trade Bitcoin, Ethereum, and 50+ cryptocurrencies. Low fees, secure platform, and instant withdrawals.", imageUrl: IMG.crypto, thumbnailUrl: IMG.crypto, type: "featured", placement: "feed", callToAction: "sign_up", pricingModel: "cpa", totalBudget: 15000, bidAmount: 3.5, dailyBudgetLimit: 600, priority: 9, frequency: 3, targetUrl: "https://example.com/crypto-trading", targetAgeRanges: ["18-24","25-34"], targetGender: "all", targetLocations: ["Uganda","Kenya","Nigeria"], targetInterests: ["cryptocurrency","investing","trading"], enableRetargeting: true },

  // -- question (5) --
  { title: "Share Knowledge, Earn Rewards", headline: "Answer & Earn UGX 500", description: "Your expertise is valuable! Answer community questions and earn instant cash rewards. Top contributors earn up to UGX 50,000/week.", imageUrl: IMG.education, thumbnailUrl: IMG.education, type: "featured", placement: "question", callToAction: "learn_more", pricingModel: "cpm", totalBudget: 8000, bidAmount: 2.0, dailyBudgetLimit: 350, priority: 10, frequency: 4, targetUrl: "https://example.com/answer-earn", targetAgeRanges: ["18-24","25-34","35-44"], targetGender: "all", targetLocations: ["Uganda","Kenya","Tanzania"], targetInterests: ["education","earning","community"], enableRetargeting: false },
  { title: "Online Tutoring — Learn Anything", headline: "Expert Tutors Available 24/7", description: "Get 1-on-1 tutoring from certified experts. Math, Science, English, and more. First session free!", imageUrl: IMG.laptop, thumbnailUrl: IMG.laptop, type: "banner", placement: "question", callToAction: "sign_up", pricingModel: "cpc", totalBudget: 5000, bidAmount: 0.8, dailyBudgetLimit: 200, priority: 7, frequency: 5, targetUrl: "https://example.com/online-tutoring", targetAgeRanges: ["13-17","18-24","25-34"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["education","learning","tutoring"], enableRetargeting: true },
  { title: "Daily Trivia Challenge", headline: "Test Your Knowledge", description: "Play daily trivia and compete with friends. Win real cash prizes every day. No entry fee required!", imageUrl: IMG.gaming, thumbnailUrl: IMG.gaming, type: "regular", placement: "question", callToAction: "learn_more", pricingModel: "cpm", totalBudget: 4000, bidAmount: 1.5, dailyBudgetLimit: 180, priority: 6, frequency: 6, targetUrl: "https://example.com/daily-trivia", targetAgeRanges: ["13-17","18-24","25-34"], targetGender: "all", targetLocations: ["Uganda"], targetInterests: ["gaming","trivia","earning"], enableRetargeting: false },
  { title: "Smart Home Devices — 40% Off Today", headline: "Upgrade Your Home", description: "Transform your home with smart speakers, lights, and security cameras. Save 40% this week only!", imageUrl: IMG.home, thumbnailUrl: IMG.home, type: "compact", placement: "question", callToAction: "shop_now", pricingModel: "cpm", totalBudget: 4000, bidAmount: 1.5, dailyBudgetLimit: 200, priority: 5, frequency: 5, targetUrl: "https://example.com/smart-home", targetAgeRanges: ["25-34","35-44","45-54"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["technology","home","gadgets"], enableRetargeting: true },
  { title: "New Car Deals — Drive Your Dream", headline: "0% Finance Available", description: "Explore the latest models with 0% financing for 12 months. Trade-in your old car and save extra.", imageUrl: IMG.car, thumbnailUrl: IMG.car, type: "featured", placement: "question", callToAction: "learn_more", pricingModel: "cpm", totalBudget: 12000, bidAmount: 2.8, dailyBudgetLimit: 500, priority: 8, frequency: 3, targetUrl: "https://example.com/car-deals", targetAgeRanges: ["25-34","35-44","45-54"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["automotive","cars","finance"], enableRetargeting: true },

  // -- survey (2) --
  { title: "Complete Surveys, Earn Cash", headline: "UGX 2,000 Per Survey", description: "Share your opinions and get paid instantly. Quick 5-minute surveys on topics you care about. Cash out anytime!", imageUrl: IMG.business, thumbnailUrl: IMG.business, type: "featured", placement: "survey", callToAction: "learn_more", pricingModel: "cpm", totalBudget: 7000, bidAmount: 2.0, dailyBudgetLimit: 300, priority: 9, frequency: 4, targetUrl: "https://example.com/earn-surveys", targetAgeRanges: ["18-24","25-34","35-44"], targetGender: "all", targetLocations: ["Uganda","Kenya","Tanzania"], targetInterests: ["surveys","earning","opinions"], enableRetargeting: false },
  { title: "Market Research Panel — Join Free", headline: "Your Opinion Matters", description: "Join Africa's largest market research panel. Influence products and services while earning rewards.", imageUrl: IMG.coffee, thumbnailUrl: IMG.coffee, type: "banner", placement: "survey", callToAction: "sign_up", pricingModel: "cpc", totalBudget: 4000, bidAmount: 0.65, dailyBudgetLimit: 180, priority: 7, frequency: 5, targetUrl: "https://example.com/research-panel", targetAgeRanges: ["18-24","25-34","35-44","45-54"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["surveys","research","earning"], enableRetargeting: true },

  // -- video (2) --
  { title: "Stream Music Premium — 3 Months Free", headline: "Ad-Free Music Experience", description: "Unlimited music, offline downloads, and ad-free listening. Try 3 months free — cancel anytime!", imageUrl: IMG.music, videoUrl: VID.fun, thumbnailUrl: IMG.music, type: "featured", placement: "video", callToAction: "subscribe", pricingModel: "cpa", totalBudget: 12000, bidAmount: 2.0, dailyBudgetLimit: 500, priority: 9, frequency: 3, targetUrl: "https://example.com/music-premium", targetAgeRanges: ["13-17","18-24","25-34"], targetGender: "all", targetLocations: ["Uganda","Kenya","Tanzania","Nigeria"], targetInterests: ["music","entertainment","streaming"], enableRetargeting: true },
  { title: "Fitness App — Transform Your Body", headline: "Join 500K+ Active Users", description: "Personalized workouts, meal plans, and progress tracking. Start your 7-day free trial today!", imageUrl: IMG.fitness, videoUrl: VID.escapes, thumbnailUrl: IMG.fitness, type: "banner", placement: "video", callToAction: "download", pricingModel: "cpc", totalBudget: 6000, bidAmount: 0.55, dailyBudgetLimit: 250, priority: 7, frequency: 4, targetUrl: "https://example.com/fitness-app", targetAgeRanges: ["18-24","25-34","35-44"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["fitness","health","wellness"], enableRetargeting: true },

  // -- profile (2) --
  { title: "Upgrade Your Profile — Go Pro", headline: "Stand Out From the Crowd", description: "Get a verified badge, custom themes, and priority visibility. Pro members earn 2x rewards on every activity!", imageUrl: IMG.fashion, thumbnailUrl: IMG.fashion, type: "compact", placement: "profile", callToAction: "sign_up", pricingModel: "cpm", totalBudget: 3000, bidAmount: 1.2, dailyBudgetLimit: 150, priority: 6, frequency: 3, targetUrl: "https://example.com/go-pro", targetAgeRanges: ["18-24","25-34"], targetGender: "all", targetLocations: ["Uganda"], targetInterests: ["social","earning","status"], enableRetargeting: false },
  { title: "Career Coaching — Free Consultation", headline: "Level Up Your Career", description: "Connect with expert career coaches. Get a free 30-minute consultation and personalized career roadmap.", imageUrl: IMG.business, thumbnailUrl: IMG.business, type: "regular", placement: "profile", callToAction: "book_now", pricingModel: "cpc", totalBudget: 4000, bidAmount: 0.9, dailyBudgetLimit: 180, priority: 5, frequency: 4, targetUrl: "https://example.com/career-coaching", targetAgeRanges: ["18-24","25-34","35-44"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["career","business","growth"], enableRetargeting: true },

  // -- explore (3) --
  { title: "Travel Uganda — Hidden Gems Await", headline: "Explore East Africa", description: "Discover breathtaking destinations across Uganda. Book curated tours starting from UGX 50,000.", imageUrl: IMG.travel, videoUrl: VID.joyrides, thumbnailUrl: IMG.travel, type: "featured", placement: "explore", callToAction: "book_now", pricingModel: "cpm", totalBudget: 9000, bidAmount: 2.2, dailyBudgetLimit: 400, priority: 8, frequency: 3, targetUrl: "https://example.com/travel-uganda", targetAgeRanges: ["25-34","35-44","45-54"], targetGender: "all", targetLocations: ["Uganda","Kenya","Tanzania"], targetInterests: ["travel","adventure","tourism"], enableRetargeting: true },
  { title: "Luxury Hotel Deals — Up to 60% Off", headline: "Book Your Dream Stay", description: "Exclusive deals on top-rated hotels in Kampala, Nairobi, and Dar es Salaam. Free cancellation.", imageUrl: IMG.hotel, thumbnailUrl: IMG.hotel, type: "banner", placement: "explore", callToAction: "book_now", pricingModel: "cpc", totalBudget: 7000, bidAmount: 0.85, dailyBudgetLimit: 300, priority: 7, frequency: 4, targetUrl: "https://example.com/hotel-deals", targetAgeRanges: ["25-34","35-44","45-54"], targetGender: "all", targetLocations: ["Uganda","Kenya","Tanzania"], targetInterests: ["travel","hotels","luxury"], enableRetargeting: true },
  { title: "Latest Sneaker Drop — Limited Edition", headline: "Shop the Collection", description: "Exclusive sneakers from top brands. Limited stock. Free delivery on orders over UGX 100,000.", imageUrl: IMG.sneakers, thumbnailUrl: IMG.sneakers, type: "regular", placement: "explore", callToAction: "shop_now", pricingModel: "cpc", totalBudget: 5000, bidAmount: 0.7, dailyBudgetLimit: 220, priority: 6, frequency: 5, targetUrl: "https://example.com/sneaker-drop", targetAgeRanges: ["13-17","18-24","25-34"], targetGender: "all", targetLocations: ["Uganda","Kenya"], targetInterests: ["fashion","sneakers","streetwear"], enableRetargeting: true },
];

// ============================================================================
// AUTH + SEED LOGIC
// ============================================================================

async function authenticate() {
  console.log(`\n🔐 Authenticating as ${ADMIN_EMAIL}...`);
  try {
    const res = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const data = await res.json();

    if (data.token) {
      console.log('   Authenticated successfully');
      return { token: data.token, userId: data.user?.id };
    }
    console.error('   Auth failed:', data.message || 'No token returned');
    return null;
  } catch (err) {
    console.error('   Auth error:', err.message);
    return null;
  }
}

async function seedAds() {
  // Step 1: Authenticate
  const auth = await authenticate();
  if (!auth) {
    console.error('\n❌ Cannot seed ads without authentication. Exiting.');
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${auth.token}`,
  };

  console.log(`\n📢 Seeding ${ads.length} ads across all placements...\n`);

  let success = 0;
  let failed = 0;
  const createdAdIds = [];

  // Step 2: Create ads
  for (const ad of ads) {
    const payload = {
      ...ad,
      userId: auth.userId,
      sponsored: true,
      isActive: true,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-12-31T23:59:59Z',
    };

    try {
      const res = await fetch(`${BASE_URL}/ads/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        const adId = data.data?.id;
        console.log(`  ✅ [${ad.placement.padEnd(8)}] ${ad.type.padEnd(8)} → ${ad.title}`);
        if (adId) createdAdIds.push(adId);
        success++;
      } else {
        console.log(`  ❌ [${ad.placement.padEnd(8)}] ${ad.title}: ${data.message}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ [${ad.placement.padEnd(8)}] ${ad.title}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Create: ${success} created, ${failed} failed`);

  // Step 3: Auto-approve all created ads (they default to 'pending')
  if (createdAdIds.length > 0) {
    console.log(`\n✅ Auto-approving ${createdAdIds.length} ads...`);
    let approved = 0;
    for (const adId of createdAdIds) {
      try {
        const res = await fetch(`${BASE_URL}/ads/${adId}/approve`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ adminUserId: auth.userId }),
        });
        const data = await res.json();
        if (data.success) {
          approved++;
        } else {
          console.log(`  ⚠️  Could not approve ${adId}: ${data.message}`);
        }
      } catch (err) {
        console.log(`  ⚠️  Could not approve ${adId}: ${err.message}`);
      }
    }
    console.log(`   Approved: ${approved}/${createdAdIds.length}`);
  }

  // Step 4: Verify coverage
  console.log('\n🔍 Verifying approved ads (public feed)...');
  try {
    const res = await fetch(`${BASE_URL}/ads/all?limit=100`);
    const data = await res.json();
    if (data.success && data.data && data.data.all) {
      const placements = {};
      for (const ad of data.data.all) {
        placements[ad.placement] = (placements[ad.placement] || 0) + 1;
      }
      console.log('   Placement distribution:');
      for (const [p, count] of Object.entries(placements).sort()) {
        console.log(`     ${p.padEnd(12)} → ${count} ads`);
      }
      console.log(`   Total approved ads: ${data.pagination.total}`);
    } else {
      console.log('   No approved ads found in public feed!');
      console.log('   Raw response:', JSON.stringify(data).slice(0, 300));
    }
  } catch (err) {
    console.log('   Could not verify:', err.message);
  }
}

seedAds();
