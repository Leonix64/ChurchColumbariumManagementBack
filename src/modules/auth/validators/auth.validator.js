/**
 * VALIDADORES DE AUTENTICACION
 * Valida datos de entrada antes de procesarlos
 */

const { errors } = require('../../../middlewares/errorHandler');

const authValidator = {
    // Validar registro de usuario
    validateRegister: (req, res, next) => {
        const { username, email, password, fullName } = req.body;
        const validationErrors = [];

        // Username
        if (!username) {
            validationErrors.push({
                field: 'username',
                message: 'El nombre de usuario es obligatorio'
            });
        } else if (username.length < 3) {
            validationErrors.push({
                field: 'username',
                message: 'El nombre de usuario debe tener al menos 3 caracteres'
            });
        } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            validationErrors.push({
                field: 'username',
                message: 'El usuario solo puede contener letras, numeros y guiones bajos'
            });
        }

        // Email
        if (!email) {
            validationErrors.push({
                field: 'email',
                message: 'El email es requerido'
            });
        } else if (!/^\S+@\S+\.\S+$/.test(email)) {
            validationErrors.push({
                field: 'email',
                message: 'Email invalido'
            });
        }

        // Password
        if (!password) {
            validationErrors.push({
                field: 'password',
                message: 'La contraseña es requerida'
            });
        } else if (password.length < 8) {
            validationErrors.push({
                field: 'password',
                message: 'La contraseña debe tener al menos 8 caracteres'
            });
        } else {
            // Verificar complejidad de password
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            const hasSpecial = /[!@#$%^&*]/.test(password);

            if (!(hasUpperCase && hasLowerCase && hasNumber)) {
                validationErrors.push({
                    field: 'password',
                    message: 'La contraseña debe contener mayusculas, minusculas y numeros'
                });
            }
        }

        // Full Name
        if (!fullName) {
            validationErrors.push({
                field: 'fullName',
                message: 'El nombre completo es requerido'
            });
        } else if (fullName.length < 3) {
            validationErrors.push({
                field: 'fullName',
                message: 'El nombre debe tener al menos 3 caracteres'
            });
        }

        // Si hay errores, retornar
        if (validationErrors.length > 0) {
            return next(errors.badRequest('Errores de validacion', validationErrors));
        }

        next();
    },

    // Validar login
    validateLogin: (req, res, next) => {
        const { username, password } = req.body;
        const validationErrors = [];

        if (!username) {
            validationErrors.push({
                field: 'username',
                message: 'Usuario o email requerido'
            });
        }

        if (!password) {
            validationErrors.push({
                field: 'password',
                message: 'Contraseña requerida'
            });
        }

        if (validationErrors.length > 0) {
            return next(errors.badRequest('Datos incompletos', validationErrors));
        }

        next();
    },

    // Validar cambio de contraseña
    validateChangePassword: (req, res, next) => {
        const { currentPassword, newPassword } = req.body;
        const validationErrors = [];

        if (!currentPassword) {
            validationErrors.push({
                field: 'currentPassword',
                message: 'La contraseña actual es requerida'
            });
        }

        if (!newPassword) {
            validationErrors.push({
                field: 'newPassword',
                message: 'La nueva contraseña es requerida'
            });
        } else if (newPassword.length < 8) {
            validationErrors.push({
                field: 'newPassword',
                message: 'La nueva contraseña debe tener al menos 8 caracteres'
            });
        } else {
            const hasUpperCase = /[A-Z]/.test(newPassword);
            const hasLowerCase = /[a-z]/.test(newPassword);
            const hasNumber = /[0-9]/.test(newPassword);

            if (!(hasUpperCase && hasLowerCase && hasNumber)) {
                validationErrors.push({
                    field: 'newPassword',
                    message: 'La contraseña debe contener mayusculas, minusculas y numeros'
                });
            }
        }

        if (currentPassword === newPassword) {
            validationErrors.push({
                field: 'newPassword',
                message: 'La nueva contraseña debe ser diferente a la actual'
            });
        }

        if (validationErrors.length > 0) {
            return next(errors.badRequest('Errores de validacion', validationErrors));
        }

        next();
    },

    // Validar refresh token
    validateRefreshToken: (req, res, next) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return next(errors.badRequest('Refresh token requerido'));
        }

        next();
    }
};

module.exports = authValidator;
