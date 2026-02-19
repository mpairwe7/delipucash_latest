import prisma from '../lib/prisma.mjs';

// Create a new survey template
export const createTemplate = async (req, res) => {
  try {
    const { name, description, category, questions, branding, isPublic } = req.body;
    const userId = req.user.id;

    if (!name || !questions) {
      return res.status(400).json({
        success: false,
        message: 'name and questions are required.',
      });
    }

    const template = await prisma.surveyTemplate.create({
      data: {
        userId,
        name,
        description: description || null,
        category: category || null,
        questions,
        branding: branding || null,
        isPublic: isPublic ?? false,
      },
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('Error creating survey template:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating survey template',
      error: error.message,
    });
  }
};

// List templates: ?mine=true for user's own, otherwise public + user's own.
// Optional ?category= filter. Ordered by usageCount desc, createdAt desc.
export const listTemplates = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mine, category } = req.query;

    const where = {};

    if (mine === 'true') {
      // Only the user's own templates
      where.userId = userId;
    } else {
      // Public templates + user's own
      where.OR = [
        { isPublic: true },
        { userId },
      ];
    }

    if (category) {
      where.category = category;
    }

    const templates = await prisma.surveyTemplate.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error('Error listing survey templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing survey templates',
      error: error.message,
    });
  }
};

// Get a single template by id. Only return if public or owned by user.
export const getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const template = await prisma.surveyTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found.',
      });
    }

    if (!template.isPublic && template.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This template is private.',
      });
    }

    res.status(200).json({ success: true, data: template });
  } catch (error) {
    console.error('Error fetching survey template:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching survey template',
      error: error.message,
    });
  }
};

// Delete a template by id. Only if owned by user.
export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const template = await prisma.surveyTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found.',
      });
    }

    if (template.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own templates.',
      });
    }

    await prisma.surveyTemplate.delete({
      where: { id },
    });

    res.status(200).json({ success: true, message: 'Template deleted successfully.' });
  } catch (error) {
    console.error('Error deleting survey template:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting survey template',
      error: error.message,
    });
  }
};

// Increment usageCount atomically and return the template's questions JSON.
export const useTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch first to check access
    const existing = await prisma.surveyTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Template not found.',
      });
    }

    if (!existing.isPublic && existing.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This template is private.',
      });
    }

    // Atomically increment usageCount and return updated record
    const updated = await prisma.surveyTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });

    res.status(200).json({ success: true, data: { questions: updated.questions } });
  } catch (error) {
    console.error('Error using survey template:', error);
    res.status(500).json({
      success: false,
      message: 'Error using survey template',
      error: error.message,
    });
  }
};
