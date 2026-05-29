const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/devices
async function getDevices(req, res, next) {
  try {
    const { companyId, type, search, page = 1, limit = 25 } = req.query;

    const where = {};

    if (companyId) {
      where.companyId = companyId;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [devices, total] = await Promise.all([
      prisma.device.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true },
          },
          _count: {
            select: { tickets: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.device.count({ where }),
    ]);

    res.json({
      devices,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/devices/:id
async function getDevice(req, res, next) {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true },
        },
        tickets: {
          take: 10,
          include: {
            ticket: {
              select: {
                id: true,
                ticketNumber: true,
                subject: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Flatten ticket data
    const formattedDevice = {
      ...device,
      tickets: device.tickets.map((td) => ({ ticketId: td.ticketId, ticket: td.ticket })),
    };

    res.json({ device: formattedDevice });
  } catch (error) {
    next(error);
  }
}

// POST /api/devices
async function createDevice(req, res, next) {
  try {
    const {
      name,
      type,
      make,
      model,
      serialNumber,
      operatingSystem,
      ipAddress,
      notes,
      companyId,
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Device name is required' });
    }
    if (!type) {
      return res.status(400).json({ error: 'Device type is required' });
    }
    if (!companyId) {
      return res.status(400).json({ error: 'Company is required' });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const device = await prisma.device.create({
      data: {
        name: name.trim(),
        type,
        make,
        model,
        serialNumber,
        operatingSystem,
        ipAddress,
        notes,
        companyId,
      },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(device);
  } catch (error) {
    next(error);
  }
}

// PUT /api/devices/:id
async function updateDevice(req, res, next) {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      make,
      model,
      serialNumber,
      operatingSystem,
      ipAddress,
      notes,
      companyId,
      isActive,
    } = req.body;

    // Verify device exists
    const existing = await prisma.device.findUnique({
      where: { id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) updateData.type = type;
    if (make !== undefined) updateData.make = make;
    if (model !== undefined) updateData.model = model;
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
    if (operatingSystem !== undefined) updateData.operatingSystem = operatingSystem;
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress;
    if (notes !== undefined) updateData.notes = notes;
    if (companyId !== undefined) updateData.companyId = companyId;
    if (isActive !== undefined) updateData.isActive = isActive;

    const device = await prisma.device.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(device);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/devices/:id
async function deleteDevice(req, res, next) {
  try {
    const { id } = req.params;

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        tickets: {
          include: {
            ticket: true,
          },
        },
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check for open tickets
    const openTickets = device.tickets.filter(
      (td) => td.ticket.status === 'OPEN' || td.ticket.status === 'PENDING'
    );

    if (openTickets.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete device linked to open tickets',
        openTicketCount: openTickets.length,
      });
    }

    await prisma.device.delete({
      where: { id },
    });

    res.json({ message: 'Device deleted' });
  } catch (error) {
    next(error);
  }
}

// POST /api/tickets/:ticketId/devices
async function linkDeviceToTicket(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check if already linked
    const existing = await prisma.ticketDevice.findUnique({
      where: {
        ticketId_deviceId: { ticketId, deviceId },
      },
    });
    if (existing) {
      return res.status(400).json({ error: 'Device already linked to this ticket' });
    }

    // Create link
    await prisma.ticketDevice.create({
      data: { ticketId, deviceId },
    });

    // Create activity log
    await prisma.ticketActivity.create({
      data: {
        ticketId,
        type: 'device_linked',
        description: `Device linked: ${device.name}`,
        userId: req.user.id,
        metadata: { deviceId, deviceName: device.name },
      },
    });

    res.json({ message: 'Device linked' });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/tickets/:ticketId/devices/:deviceId
async function unlinkDeviceFromTicket(req, res, next) {
  try {
    const { ticketId, deviceId } = req.params;

    // Verify link exists
    const link = await prisma.ticketDevice.findUnique({
      where: {
        ticketId_deviceId: { ticketId, deviceId },
      },
    });

    if (!link) {
      return res.status(404).json({ error: 'Device link not found' });
    }

    await prisma.ticketDevice.delete({
      where: {
        ticketId_deviceId: { ticketId, deviceId },
      },
    });

    res.json({ message: 'Device unlinked' });
  } catch (error) {
    next(error);
  }
}

// GET /api/tickets/:ticketId/devices
async function getTicketDevices(req, res, next) {
  try {
    const { ticketId } = req.params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketDevices = await prisma.ticketDevice.findMany({
      where: { ticketId },
      include: {
        device: {
          include: {
            company: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const devices = ticketDevices.map((td) => td.device);

    res.json({ devices });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  linkDeviceToTicket,
  unlinkDeviceFromTicket,
  getTicketDevices,
};
