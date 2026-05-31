const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Fields to exclude password from user responses
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  signature: true,
  availability: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * GET /api/agents
 * Get all active agents with their groups
 */
const getAgents = async (req, res, next) => {
  try {
    const { role } = req.query;

    const where = { isActive: true };
    if (role) {
      where.role = role;
    }

    const agents = await prisma.user.findMany({
      where,
      select: {
        ...userSelect,
        groups: {
          include: {
            group: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform groups structure
    const transformedAgents = agents.map((agent) => ({
      ...agent,
      groups: agent.groups.map((ug) => ug.group),
    }));

    res.json({ agents: transformedAgents });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/agents/:id
 * Get single agent by ID
 */
const getAgent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const agent = await prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        groups: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Transform groups structure
    const transformedAgent = {
      ...agent,
      groups: agent.groups.map((ug) => ug.group),
    };

    res.json(transformedAgent);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/agents
 * Create new agent (ADMIN only)
 */
const createAgent = async (req, res, next) => {
  try {
    const { name, email, password, role, signature } = req.body;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const agent = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'AGENT',
        signature,
      },
      select: userSelect,
    });

    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/agents/:id
 * Update agent (ADMIN only)
 */
const updateAgent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, avatar, signature, availability, isActive } = req.body;

    // Check if agent exists
    const existingAgent = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Prevent changing own role
    if (role && req.user.id === id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Check if email is being changed and already exists
    if (email && email !== existingAgent.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (signature !== undefined) updateData.signature = signature;
    if (availability !== undefined) updateData.availability = availability;
    if (isActive !== undefined) updateData.isActive = isActive;

    const agent = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    res.json(agent);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/agents/:id/availability
 * Update agent availability (agent can update own, admin can update any)
 */
const updateAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { availability } = req.body;

    // Check if user can update this agent's availability
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      return res.status(403).json({ error: 'Cannot update another agent\'s availability' });
    }

    // Check if agent exists
    const existingAgent = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = await prisma.user.update({
      where: { id },
      data: { availability },
      select: {
        id: true,
        availability: true,
      },
    });

    res.json(agent);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/agents/:id
 * Soft delete agent (sets isActive=false)
 */
const deleteAgent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }

    // Check if agent exists
    const existingAgent = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Soft delete - set isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Agent deactivated' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups
 * Get all groups with their member agents
 */
const getGroups = async (req, res, next) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        agents: {
          include: {
            user: {
              select: userSelect,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform structure
    const transformedGroups = groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      agents: group.agents.map((ua) => ua.user),
    }));

    res.json(transformedGroups);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups
 * Create new group (ADMIN only)
 */
const createGroup = async (req, res, next) => {
  try {
    const { name, description, agentIds } = req.body;

    // Create group
    const group = await prisma.group.create({
      data: {
        name,
        description,
      },
    });

    // Add agents to group if provided
    if (agentIds && agentIds.length > 0) {
      await prisma.userGroup.createMany({
        data: agentIds.map((userId) => ({
          userId,
          groupId: group.id,
        })),
        skipDuplicates: true,
      });
    }

    // Fetch group with members
    const groupWithMembers = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        agents: {
          include: {
            user: {
              select: userSelect,
            },
          },
        },
      },
    });

    // Transform structure
    const transformedGroup = {
      id: groupWithMembers.id,
      name: groupWithMembers.name,
      description: groupWithMembers.description,
      createdAt: groupWithMembers.createdAt,
      updatedAt: groupWithMembers.updatedAt,
      agents: groupWithMembers.agents.map((ua) => ua.user),
    };

    res.status(201).json(transformedGroup);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  updateAvailability,
  deleteAgent,
  getGroups,
  createGroup,
};
