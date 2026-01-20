import prisma from '../lib/prisma.mjs';
import asyncHandler from 'express-async-handler';

// Like or Unlike a Response
export const likeResponse = asyncHandler(async (req, res) => {
  const { responseId } = req.params;
  const { userId, isLiked } = req.body;

  console.log('Like request:', { responseId, userId, isLiked });

  try {
    // Check if response exists
    const response = await prisma.response.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }

    // Check if user exists
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isLiked) {
      // Add like (check if already exists)
      const existingLike = await prisma.responseLike.findUnique({
        where: {
          userId_responseId: {
            userId,
            responseId,
          },
        },
      });

      if (!existingLike) {
        await prisma.responseLike.create({
          data: {
            userId,
            responseId,
          },
        });

        // Remove dislike if it exists (user can't both like and dislike)
        await prisma.responseDislike.deleteMany({
          where: {
            userId,
            responseId,
          },
        });
      }
    } else {
      // Remove like
      await prisma.responseLike.deleteMany({
        where: {
          userId,
          responseId,
        },
      });
    }

    // Get updated counts
    const likeCount = await prisma.responseLike.count({
      where: { responseId },
    });

    const dislikeCount = await prisma.responseDislike.count({
      where: { responseId },
    });

    // Check current user's like/dislike status
    const userLike = await prisma.responseLike.findUnique({
      where: {
        userId_responseId: {
          userId,
          responseId,
        },
      },
    });

    const userDislike = await prisma.responseDislike.findUnique({
      where: {
        userId_responseId: {
          userId,
          responseId,
        },
      },
    });

    res.json({
      message: isLiked ? 'Response liked successfully' : 'Like removed successfully',
      likeCount,
      dislikeCount,
      isLiked: !!userLike,
      isDisliked: !!userDislike,
    });
  } catch (error) {
    console.error('Error updating like status:', error);
    res.status(500).json({ message: 'Failed to update like status', error: error.message });
  }
});

// Dislike or Remove Dislike from a Response
export const dislikeResponse = asyncHandler(async (req, res) => {
  const { responseId } = req.params;
  const { userId, isDisliked } = req.body;

  console.log('Dislike request:', { responseId, userId, isDisliked });

  try {
    // Check if response exists
    const response = await prisma.response.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }

    // Check if user exists
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isDisliked) {
      // Add dislike (check if already exists)
      const existingDislike = await prisma.responseDislike.findUnique({
        where: {
          userId_responseId: {
            userId,
            responseId,
          },
        },
      });

      if (!existingDislike) {
        await prisma.responseDislike.create({
          data: {
            userId,
            responseId,
          },
        });

        // Remove like if it exists (user can't both like and dislike)
        await prisma.responseLike.deleteMany({
          where: {
            userId,
            responseId,
          },
        });
      }
    } else {
      // Remove dislike
      await prisma.responseDislike.deleteMany({
        where: {
          userId,
          responseId,
        },
      });
    }

    // Get updated counts
    const likeCount = await prisma.responseLike.count({
      where: { responseId },
    });

    const dislikeCount = await prisma.responseDislike.count({
      where: { responseId },
    });

    // Check current user's like/dislike status
    const userLike = await prisma.responseLike.findUnique({
      where: {
        userId_responseId: {
          userId,
          responseId,
        },
      },
    });

    const userDislike = await prisma.responseDislike.findUnique({
      where: {
        userId_responseId: {
          userId,
          responseId,
        },
      },
    });

    res.json({
      message: isDisliked ? 'Response disliked successfully' : 'Dislike removed successfully',
      likeCount,
      dislikeCount,
      isLiked: !!userLike,
      isDisliked: !!userDislike,
    });
  } catch (error) {
    console.error('Error updating dislike status:', error);
    res.status(500).json({ message: 'Failed to update dislike status', error: error.message });
  }
});

// Submit a Reply to a Response
export const submitReply = asyncHandler(async (req, res) => {
  const { responseId } = req.params;
  const { replyText, userId } = req.body;

  console.log('Reply submission:', { responseId, replyText, userId });

  try {
    // Validate input
    if (!replyText || !replyText.trim()) {
      return res.status(400).json({ message: 'Reply text is required' });
    }

    // Check if response exists
    const response = await prisma.response.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }

    // Check if user exists
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create the reply
    const reply = await prisma.responseReply.create({
      data: {
        replyText: replyText.trim(),
        userId,
        responseId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get updated reply count
    const replyCount = await prisma.responseReply.count({
      where: { responseId },
    });

    res.status(201).json({
      message: 'Reply posted successfully',
      reply,
      replyCount,
    });
  } catch (error) {
    console.error('Error submitting reply:', error);
    res.status(500).json({ message: 'Failed to post reply', error: error.message });
  }
});

// Get All Replies for a Response
export const getRepliesForResponse = asyncHandler(async (req, res) => {
  const { responseId } = req.params;

  console.log('Fetching replies for response:', responseId);

  try {
    // Check if response exists
    const response = await prisma.response.findUnique({
      where: { id: responseId },
    });

    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }

    // Fetch replies
    const replies = await prisma.responseReply.findMany({
      where: { responseId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Show oldest replies first
      },
    });

    res.json({
      replies,
      count: replies.length,
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Failed to fetch replies', error: error.message });
  }
});

// Get Response with Like/Dislike/Reply Counts and User Status
export const getResponseWithCounts = asyncHandler(async (req, res) => {
  const { responseId } = req.params;
  const { userId } = req.query;

  console.log('Fetching response with counts:', { responseId, userId });

  try {
    // Check if response exists
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }

    // Get counts
    const likeCount = await prisma.responseLike.count({
      where: { responseId },
    });

    const dislikeCount = await prisma.responseDislike.count({
      where: { responseId },
    });

    const replyCount = await prisma.responseReply.count({
      where: { responseId },
    });

    let isLiked = false;
    let isDisliked = false;

    // Check user's like/dislike status if userId is provided
    if (userId) {
      const userLike = await prisma.responseLike.findUnique({
        where: {
          userId_responseId: {
            userId,
            responseId,
          },
        },
      });

      const userDislike = await prisma.responseDislike.findUnique({
        where: {
          userId_responseId: {
            userId,
            responseId,
          },
        },
      });

      isLiked = !!userLike;
      isDisliked = !!userDislike;
    }

    res.json({
      ...response,
      likeCount,
      dislikeCount,
      replyCount,
      isLiked,
      isDisliked,
    });
  } catch (error) {
    console.error('Error fetching response with counts:', error);
    res.status(500).json({ message: 'Failed to fetch response data', error: error.message });
  }
});