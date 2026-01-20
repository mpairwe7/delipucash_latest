// Test file for response API endpoints
// This file can be used to test the response endpoints manually

const BASE_URL = 'http://localhost:3000/api'; // Adjust based on your server URL

// Test data
const testData = {
  userId: 'your-user-id-here', // Replace with actual user ID
  responseId: 'your-response-id-here', // Replace with actual response ID
  replyText: 'This is a test reply'
};

// Test functions
const testLikeResponse = async () => {
  try {
    const response = await fetch(`${BASE_URL}/responses/${testData.responseId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testData.userId,
        isLiked: true
      })
    });
    
    const data = await response.json();
    console.log('Like Response Test:', data);
  } catch (error) {
    console.error('Error testing like response:', error);
  }
};

const testDislikeResponse = async () => {
  try {
    const response = await fetch(`${BASE_URL}/responses/${testData.responseId}/dislike`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testData.userId,
        isDisliked: true
      })
    });
    
    const data = await response.json();
    console.log('Dislike Response Test:', data);
  } catch (error) {
    console.error('Error testing dislike response:', error);
  }
};

const testSubmitReply = async () => {
  try {
    const response = await fetch(`${BASE_URL}/responses/${testData.responseId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testData.userId,
        replyText: testData.replyText
      })
    });
    
    const data = await response.json();
    console.log('Submit Reply Test:', data);
  } catch (error) {
    console.error('Error testing submit reply:', error);
  }
};

const testGetReplies = async () => {
  try {
    const response = await fetch(`${BASE_URL}/responses/${testData.responseId}/replies`);
    const data = await response.json();
    console.log('Get Replies Test:', data);
  } catch (error) {
    console.error('Error testing get replies:', error);
  }
};

const testGetResponseWithCounts = async () => {
  try {
    const response = await fetch(`${BASE_URL}/responses/${testData.responseId}?userId=${testData.userId}`);
    const data = await response.json();
    console.log('Get Response with Counts Test:', data);
  } catch (error) {
    console.error('Error testing get response with counts:', error);
  }
};

// Uncomment to run tests
// testLikeResponse();
// testDislikeResponse();
// testSubmitReply();
// testGetReplies();
// testGetResponseWithCounts();

export {
  testLikeResponse,
  testDislikeResponse,
  testSubmitReply,
  testGetReplies,
  testGetResponseWithCounts
};