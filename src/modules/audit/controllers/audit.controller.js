const Audit = require('../models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const auditController = {
    /**
     * LISTAR LOGS DE AUDITORIA
     * GET /api/audit
     * Query params: module, action, user, startDate, endDate, limit, page
     */
    getAllLogs: asyncHandler(async (req, res) => {
        const {
            module,
            action,
            user,
            startDate,
            endDate,
            status,
            limit = 100,
            page = 1
        } = req.query;

        let filter = {};

        // Filtros
        if (module) filter.module = module;
        if (action) filter.action = action;
        if (user) filter.user = user;
        if (status) filter.status = status;

        // Filtro por rango de fechas
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Incluir todo el dia
                filter.timestamp.$lte = end;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const logs = await Audit.find(filter)
            .populate('user', 'username fullName role email')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Audit.countDocuments(filter);

        res.json({
            success: true,
            count: logs.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: logs
        });
    }),

    /**
     * ESTADISTICAS DE AUDITORIA
     * GET /api/audit/stats
     */
    getStats: asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;
        let dateFilter = {};

        if (startDate || endDate) {
            dateFilter.timestamp = {};
            if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.timestamp.$lte = end;
            }
        }

        // Total de logs
        const total = await Audit.countDocuments(dateFilter);

        // Por módulo
        const byModule = await Audit.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$module', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Por acción
        const byAction = await Audit.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Por estado
        const byStatus = await Audit.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Top usuarios mas activos
        const topUsers = await Audit.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$user', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $project: {
                    _id: 1,
                    count: 1,
                    username: { $arrayElemAt: ['$userInfo.username', 0] },
                    fullName: { $arrayElemAt: ['$userInfo.fullName', 0] },
                    role: { $arrayElemAt: ['$userInfo.role', 0] }
                }
            }
        ]);

        // Actividad por dia (ultimos 7 dias)
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const activityByDay = await Audit.aggregate([
            {
                $match: {
                    timestamp: { $gte: last7Days }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Errores recientes
        const recentErrors = await Audit.find({
            status: 'error',
            ...dateFilter
        })
            .populate('user', 'username fullName')
            .sort({ timestamp: -1 })
            .limit(10);

        res.json({
            success: true,
            data: {
                total,
                byModule,
                byAction,
                byStatus,
                topUsers,
                activityByDay,
                recentErrors
            }
        });
    }),

    /**
     * HISTORIAL DE UN RECURSO ESPECIFICO
     * GET /api/audit/resource/:resourceId
     */
    getResourceHistory: asyncHandler(async (req, res) => {
        const { resourceId } = req.params;

        if (!resourceId) {
            throw errors.badRequest('ID de recurso requerido');
        }

        const logs = await Audit.find({ resourceId })
            .populate('user', 'username fullName role email')
            .sort({ timestamp: -1 });

        res.json({
            success: true,
            count: logs.length,
            resourceId,
            data: logs
        });
    }),

    /**
     * HISTORIAL DE UN USUARIO ESPECIFICO
     * GET /api/audit/user/:userId
     */
    getUserHistory: asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { limit = 50, page = 1 } = req.query;

        if (!userId) {
            throw errors.badRequest('ID de usuario requerido');
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const logs = await Audit.find({ user: userId })
            .populate('user', 'username fullName role')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Audit.countDocuments({ user: userId });

        res.json({
            success: true,
            count: logs.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            userId,
            data: logs
        });
    }),

    /**
     * ACTIVIDAD RECIENTE (Dashboard)
     * GET /api/audit/recent
     */
    getRecentActivity: asyncHandler(async (req, res) => {
        const { limit = 20 } = req.query;

        const logs = await Audit.find()
            .populate('user', 'username fullName role')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            count: logs.length,
            data: logs
        });
    }),

    /**
     * CREAR LOG MANUALMENTE (Opcional)
     * POST /api/audit
     * Solo para casos especiales donde se necesite registrar algo manual
     */
    createLog: asyncHandler(async (req, res) => {
        const {
            action,
            module,
            resourceType,
            resourceId,
            details,
            status = 'success'
        } = req.body;

        if (!action || !module) {
            throw errors.badRequest('action y module son requeridos');
        }

        const newLog = await Audit.create({
            user: req.user?.id,
            username: req.user?.username,
            userRole: req.user?.role,
            action,
            module,
            resourceType,
            resourceId,
            details,
            status,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Log creado exitosamente',
            data: newLog
        });
    }),

    /**
     * LIMPIAR LOGS ANTIGUOS
     * DELETE /api/audit/cleanup
     * Elimina logs mas antiguos de X dias (solo admin)
     */
    cleanupOldLogs: asyncHandler(async (req, res) => {
        // Soportar body y query params
        const daysOld = req.body?.daysOld || req.query?.daysOld || 365;

        if (parseInt(daysOld) < 90) {
            throw errors.badRequest('No se pueden eliminar logs menores a 90 días');
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld));

        const result = await Audit.deleteMany({
            timestamp: { $lt: cutoffDate }
        });

        res.json({
            success: true,
            message: `${result.deletedCount} logs eliminados`,
            data: {
                deletedCount: result.deletedCount,
                cutoffDate,
                daysOld: parseInt(daysOld)
            }
        });
    }),

    /**
     * REPORTE DE ACTIVIDAD POR RANGO DE FECHAS
     * GET /api/audit/report
     */
    getActivityReport: asyncHandler(async (req, res) => {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        if (!startDate || !endDate) {
            throw errors.badRequest('startDate y endDate son requeridos');
        }

        const start = new Date(startDate + 'T00:00:00.000Z');
        const end = new Date(endDate + 'T23:59:59.999Z');

        // Formato de agrupación
        let dateFormat;
        switch (groupBy) {
            case 'hour':
                dateFormat = '%Y-%m-%d %H:00';
                break;
            case 'day':
                dateFormat = '%Y-%m-%d';
                break;
            case 'week':
                dateFormat = '%Y-W%U';
                break;
            case 'month':
                dateFormat = '%Y-%m';
                break;
            default:
                dateFormat = '%Y-%m-%d';
        }

        const report = await Audit.aggregate([
            {
                $match: {
                    timestamp: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: dateFormat, date: '$timestamp' } },
                        module: '$module',
                        action: '$action'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.date': 1 }
            }
        ]);

        res.json({
            success: true,
            dateRange: {
                start: start,
                end: end,
                groupBy
            },
            data: report
        });
    })
};

module.exports = auditController;
