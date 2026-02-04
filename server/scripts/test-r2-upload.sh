#!/bin/bash

# ============================================================================
# R2 Upload Test Script
# ============================================================================
# Tests video and ad media uploads to Cloudflare R2 storage
# 
# Prerequisites:
# 1. Server running on localhost:3000
# 2. Valid user ID from the database
# 3. Test media files (video.mp4, image.jpg)
#
# Environment variables from .env:
# - CLOUDFLARE_ACCOUNT_ID
# - R2_ACCESS_KEY_ID  
# - R2_SECRET_ACCESS_KEY
# - R2_BUCKET_NAME
# - R2_PUBLIC_URL
#
# Login credentials from .env:
# - ADMIN_EMAIL=admin@delipucash.com
# - ADMIN_PASSWORD=admin123456
# ============================================================================

# Configuration
BASE_URL="${SERVER_URL:-http://localhost:3000}"
API_URL="$BASE_URL/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# ============================================================================
# 1. LOGIN AND GET AUTH TOKEN
# ============================================================================
print_section "1. Login to get authentication token"

echo "Logging in with admin credentials..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "admin@delipucash.com",
        "password": "admin123456"
    }')

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq .

# Extract token (adjust based on your API response structure)
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // .accessToken // .data.token // empty')
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id // .data.user.id // .userId // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    print_error "Failed to get authentication token"
    echo "Make sure the server is running and admin user exists"
    
    # Try to extract any userId from response for testing purposes
    USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id // empty')
else
    print_success "Got authentication token"
    echo "User ID: $USER_ID"
fi

# ============================================================================
# 2. HEALTH CHECK
# ============================================================================
print_section "2. Health Check"

HEALTH_RESPONSE=$(curl -s -X GET "$API_URL/health")
echo "$HEALTH_RESPONSE" | jq .

if echo "$HEALTH_RESPONSE" | jq -e '.status == "OK"' > /dev/null 2>&1; then
    print_success "Server is healthy"
else
    print_error "Server health check failed"
fi

# ============================================================================
# 3. CREATE TEST VIDEO FILE
# ============================================================================
print_section "3. Create test files"

# Create a small test video (using ffmpeg if available)
if command -v ffmpeg &> /dev/null; then
    echo "Creating test video with ffmpeg..."
    ffmpeg -y -f lavfi -i testsrc=duration=3:size=640x480:rate=30 \
        -f lavfi -i sine=frequency=1000:duration=3 \
        -c:v libx264 -c:a aac -shortest \
        /tmp/test_video.mp4 2>/dev/null
    
    if [ -f /tmp/test_video.mp4 ]; then
        print_success "Created test video: /tmp/test_video.mp4"
        ls -lh /tmp/test_video.mp4
    fi
else
    print_info "ffmpeg not found, using a placeholder approach"
    # Create a minimal valid MP4 file for testing
    echo "Please provide a test video file at /tmp/test_video.mp4"
fi

# Create a test image
if command -v convert &> /dev/null; then
    echo "Creating test image with ImageMagick..."
    convert -size 640x480 xc:blue -fill white -pointsize 48 \
        -gravity center -annotate 0 "Test Ad" \
        /tmp/test_image.jpg 2>/dev/null
    
    if [ -f /tmp/test_image.jpg ]; then
        print_success "Created test image: /tmp/test_image.jpg"
        ls -lh /tmp/test_image.jpg
    fi
else
    print_info "ImageMagick not found. Creating a simple test pattern."
    # Create a minimal JPEG for testing
    echo -e '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00' > /tmp/test_image.jpg
fi

# ============================================================================
# 4. VALIDATE UPLOAD REQUEST
# ============================================================================
print_section "4. Validate upload request"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    echo "Validating upload for user: $USER_ID"
    
    VALIDATE_RESPONSE=$(curl -s -X POST "$API_URL/r2/upload/validate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{
            \"userId\": \"$USER_ID\",
            \"fileSize\": 5242880,
            \"fileName\": \"test_video.mp4\",
            \"mimeType\": \"video/mp4\",
            \"type\": \"video\"
        }")
    
    echo "Validation Response:"
    echo "$VALIDATE_RESPONSE" | jq .
    
    if echo "$VALIDATE_RESPONSE" | jq -e '.valid == true' > /dev/null 2>&1; then
        print_success "Upload validation passed"
    else
        print_info "Validation response received (check details above)"
    fi
else
    print_error "No user ID available for validation test"
fi

# ============================================================================
# 5. GET PRESIGNED UPLOAD URL
# ============================================================================
print_section "5. Get presigned upload URL"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    echo "Getting presigned URL for direct upload..."
    
    PRESIGNED_RESPONSE=$(curl -s -X POST "$API_URL/r2/presign/upload" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{
            \"userId\": \"$USER_ID\",
            \"fileName\": \"test_video.mp4\",
            \"mimeType\": \"video/mp4\",
            \"type\": \"video\",
            \"fileSize\": 5242880
        }")
    
    echo "Presigned URL Response:"
    echo "$PRESIGNED_RESPONSE" | jq .
    
    UPLOAD_URL=$(echo "$PRESIGNED_RESPONSE" | jq -r '.uploadUrl // empty')
    PUBLIC_URL=$(echo "$PRESIGNED_RESPONSE" | jq -r '.publicUrl // empty')
    OBJECT_KEY=$(echo "$PRESIGNED_RESPONSE" | jq -r '.key // empty')
    
    if [ -n "$UPLOAD_URL" ] && [ "$UPLOAD_URL" != "null" ]; then
        print_success "Got presigned upload URL"
        echo "Object key: $OBJECT_KEY"
        echo "Public URL will be: $PUBLIC_URL"
    else
        print_info "Presigned URL response received"
    fi
else
    print_error "No user ID available for presigned URL test"
fi

# ============================================================================
# 6. UPLOAD VIDEO TO R2 (via server)
# ============================================================================
print_section "6. Upload video to R2 (multipart form)"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] && [ -f /tmp/test_video.mp4 ]; then
    echo "Uploading video file to R2 via server..."
    
    VIDEO_UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/r2/upload/video" \
        -H "Authorization: Bearer $TOKEN" \
        -F "video=@/tmp/test_video.mp4;type=video/mp4" \
        -F "userId=$USER_ID" \
        -F "title=Test Video Upload" \
        -F "description=Video uploaded via curl test script")
    
    echo "Video Upload Response:"
    echo "$VIDEO_UPLOAD_RESPONSE" | jq .
    
    if echo "$VIDEO_UPLOAD_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
        print_success "Video uploaded successfully!"
        VIDEO_ID=$(echo "$VIDEO_UPLOAD_RESPONSE" | jq -r '.video.id // empty')
        VIDEO_URL=$(echo "$VIDEO_UPLOAD_RESPONSE" | jq -r '.video.videoUrl // empty')
        echo "Video ID: $VIDEO_ID"
        echo "Video URL: $VIDEO_URL"
    else
        print_error "Video upload failed"
        echo "Error: $(echo "$VIDEO_UPLOAD_RESPONSE" | jq -r '.message // .error // "Unknown error"')"
    fi
else
    if [ ! -f /tmp/test_video.mp4 ]; then
        print_info "Test video file not found at /tmp/test_video.mp4"
    else
        print_error "No user ID available for video upload test"
    fi
fi

# ============================================================================
# 7. UPLOAD AD MEDIA TO R2
# ============================================================================
print_section "7. Upload ad media to R2"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] && [ -f /tmp/test_image.jpg ]; then
    echo "Uploading ad image to R2..."
    
    AD_UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/r2/upload/ad-media" \
        -H "Authorization: Bearer $TOKEN" \
        -F "media=@/tmp/test_image.jpg;type=image/jpeg" \
        -F "userId=$USER_ID")
    
    echo "Ad Media Upload Response:"
    echo "$AD_UPLOAD_RESPONSE" | jq .
    
    if echo "$AD_UPLOAD_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
        print_success "Ad media uploaded successfully!"
        MEDIA_URL=$(echo "$AD_UPLOAD_RESPONSE" | jq -r '.media.url // empty')
        echo "Media URL: $MEDIA_URL"
    else
        print_info "Ad media upload response received"
    fi
else
    if [ ! -f /tmp/test_image.jpg ]; then
        print_info "Test image file not found at /tmp/test_image.jpg"
    else
        print_error "No user ID available for ad upload test"
    fi
fi

# ============================================================================
# 8. CREATE AD WITH UPLOADED MEDIA
# ============================================================================
print_section "8. Create ad with metadata in Prisma"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    echo "Creating ad record with metadata..."
    
    # First upload the media and get the URL
    if [ -f /tmp/test_image.jpg ]; then
        AD_MEDIA_RESPONSE=$(curl -s -X POST "$API_URL/r2/upload/ad-media" \
            -H "Authorization: Bearer $TOKEN" \
            -F "media=@/tmp/test_image.jpg;type=image/jpeg" \
            -F "userId=$USER_ID")
        
        IMAGE_URL=$(echo "$AD_MEDIA_RESPONSE" | jq -r '.media.url // empty')
    else
        IMAGE_URL="https://example.com/placeholder.jpg"
    fi
    
    # Create the ad record
    AD_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/ads" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{
            \"title\": \"Test Ad Campaign\",
            \"description\": \"This is a test ad created via curl script\",
            \"headline\": \"Amazing Offer!\",
            \"imageUrl\": \"$IMAGE_URL\",
            \"type\": \"banner\",
            \"placement\": \"feed\",
            \"sponsored\": true,
            \"targetUrl\": \"https://example.com/landing\",
            \"callToAction\": \"shop_now\",
            \"pricingModel\": \"cpm\",
            \"totalBudget\": 100.00,
            \"bidAmount\": 2.50,
            \"userId\": \"$USER_ID\"
        }")
    
    echo "Ad Creation Response:"
    echo "$AD_CREATE_RESPONSE" | jq .
    
    if echo "$AD_CREATE_RESPONSE" | jq -e '.id // .data.id // .ad.id' > /dev/null 2>&1; then
        print_success "Ad created successfully!"
    else
        print_info "Ad creation response received"
    fi
else
    print_error "No user ID available for ad creation test"
fi

# ============================================================================
# 9. DIRECT R2 UPLOAD TEST (Using presigned URL)
# ============================================================================
print_section "9. Direct upload to R2 using presigned URL"

if [ -n "$UPLOAD_URL" ] && [ "$UPLOAD_URL" != "null" ] && [ -f /tmp/test_video.mp4 ]; then
    echo "Uploading directly to R2 using presigned URL..."
    
    DIRECT_UPLOAD_RESPONSE=$(curl -s -X PUT "$UPLOAD_URL" \
        -H "Content-Type: video/mp4" \
        --data-binary @/tmp/test_video.mp4)
    
    # Check if upload was successful (empty response typically means success)
    if [ -z "$DIRECT_UPLOAD_RESPONSE" ]; then
        print_success "Direct R2 upload successful!"
        echo "File should be accessible at: $PUBLIC_URL"
    else
        echo "Direct Upload Response:"
        echo "$DIRECT_UPLOAD_RESPONSE"
    fi
else
    print_info "Skipping direct R2 upload (no presigned URL or test file)"
fi

# ============================================================================
# 10. UPLOAD VIDEO WITH THUMBNAIL
# ============================================================================
print_section "10. Upload video with thumbnail"

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] && [ -f /tmp/test_video.mp4 ] && [ -f /tmp/test_image.jpg ]; then
    echo "Uploading video with thumbnail..."
    
    COMBINED_UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/r2/upload/media" \
        -H "Authorization: Bearer $TOKEN" \
        -F "video=@/tmp/test_video.mp4;type=video/mp4" \
        -F "thumbnail=@/tmp/test_image.jpg;type=image/jpeg" \
        -F "userId=$USER_ID" \
        -F "title=Video with Thumbnail" \
        -F "description=Test upload with both video and thumbnail")
    
    echo "Combined Upload Response:"
    echo "$COMBINED_UPLOAD_RESPONSE" | jq .
    
    if echo "$COMBINED_UPLOAD_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
        print_success "Video and thumbnail uploaded successfully!"
    else
        print_info "Combined upload response received"
    fi
else
    print_info "Skipping combined upload (missing files or user ID)"
fi

# ============================================================================
# SUMMARY
# ============================================================================
print_section "Test Summary"

echo "R2 Upload Test Script completed!"
echo ""
echo "Cloudflare R2 Configuration:"
echo "  - Bucket: \$R2_BUCKET_NAME"
echo "  - Public URL: \$R2_PUBLIC_URL"
echo ""
echo "Test Files Used:"
echo "  - Video: /tmp/test_video.mp4"
echo "  - Image: /tmp/test_image.jpg"
echo ""
echo "To clean up test files:"
echo "  rm -f /tmp/test_video.mp4 /tmp/test_image.jpg"
echo ""

# ============================================================================
# CURL EXAMPLES FOR MANUAL TESTING
# ============================================================================
print_section "Manual Curl Examples"

cat << 'EOF'
# Login and get token
curl -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@delipucash.com", "password": "admin123456"}'

# Upload video
curl -X POST http://localhost:3000/api/r2/upload/video \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -F "video=@/path/to/video.mp4" \
    -F "userId=USER_UUID" \
    -F "title=My Video" \
    -F "description=Video description"

# Upload ad media (image or video)
curl -X POST http://localhost:3000/api/r2/upload/ad-media \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -F "media=@/path/to/image.jpg" \
    -F "userId=USER_UUID"

# Get presigned upload URL
curl -X POST http://localhost:3000/api/r2/presign/upload \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{
        "userId": "USER_UUID",
        "fileName": "video.mp4",
        "mimeType": "video/mp4",
        "type": "video"
    }'

# Create ad with metadata
curl -X POST http://localhost:3000/api/ads \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{
        "title": "Ad Title",
        "description": "Ad Description",
        "imageUrl": "https://r2-public-url/path/to/image.jpg",
        "videoUrl": "https://r2-public-url/path/to/video.mp4",
        "type": "video",
        "placement": "feed",
        "userId": "USER_UUID"
    }'
EOF

print_success "Script completed!"
