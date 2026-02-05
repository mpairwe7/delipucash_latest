import prisma from '../lib/prisma.mjs';
import { cacheStrategies } from '../lib/cacheStrategies.mjs';

export const getExploreItems = async (req, res) => {
  try {
    // Example: Fetch stats and quick links from various models
    // Prisma Accelerate: Aggressive cache for explore stats (24 hours TTL, 1 hour SWR)
    const [userCount, surveyCount, videoCount, topUser, topSurvey] = await Promise.all([
    ]);

    // Compose dynamic explore items
    const items = [
      {
        id: 'discover',
        icon: 'compass',
        text: 'Discover',
        colors: ['rgba(0, 123, 85, 0.8)', 'rgba(0, 123, 85, 0.6)'],
        route: '/discover',
        description: `Join ${userCount} users and explore new content.`,
      },
      {
        id: 'community',
        icon: 'account-group',
        text: 'Community',
        colors: ['rgba(0, 123, 85, 0.7)', 'rgba(0, 123, 85, 0.5)'],
        route: '/community',
        description: `Active surveys: ${surveyCount}`,
      },
      {
        id: 'trends',
        icon: 'chart-line',
        text: 'Trends',
        colors: ['rgba(0, 123, 85, 0.6)', 'rgba(0, 123, 85, 0.4)'],
        route: '/trends',
        description: `Trending videos: ${videoCount}`,
      },
      {
        id: 'leaderboard',
        icon: 'trophy',
        text: 'Leaderboard',
        colors: ['rgba(0, 123, 85, 0.5)', 'rgba(0, 123, 85, 0.3)'],
        route: '/leaderboard',
        description: topUser ? `Top user: ${topUser.firstName} ${topUser.lastName}` : '',
      },
      {
        id: 'latest-survey',
        icon: 'clipboard-text',
        text: 'Latest Survey',
        colors: ['#2196F3', '#1976D2'],
        route: topSurvey ? `/SurveyAttempt?surveyId=${topSurvey.id}` : '/Survey',
        description: topSurvey ? topSurvey.title : 'No surveys yet',
      },
    ];

    res.json(items);
  } catch (error) {
    console.error('Error in getExploreItems:', error);
    res.status(500).json({ error: 'Failed to fetch explore items' });
  }
}; 