const { response } = require('express');
const { pool, poolConnect, sql } = require('../../business/models/database');
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const { get } = require('http');
require("dotenv").config();

const getProperties = async (req, res = response) => {
    try {
        await poolConnect;
        const request = pool.request();
        const query = `
            SELECT PropertyID, OwnerID, CategoryID, Title, Description, Address, Price, Latitude, Longitude, CurrentStatus, PublishDate, IsActive 
            FROM dbo.Properties 
            WHERE IsActive = 1
        `;
        const result = await request.query(query);
        return res.json(result.recordset);
    } catch (error) {
        console.error('Error en getProperties:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const createProperty = async (req, res = response) => {
    const { title, categoryId, address, latitude, longitude, price, description, ownerId } = req.body;
    const imageFiles = req.files ? req.files : [];

    // Validación de campos obligatorios
    if (!title || !categoryId || !address || !latitude || !longitude || !price || !description || !ownerId) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    let transaction;
    try {
        await poolConnect;
        const propertyId = crypto.randomUUID();

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        // Insertar en dbo.Properties
        const propertyRequest = new sql.Request(transaction);
        const propertyQuery = `
            INSERT INTO dbo.Properties (PropertyID, OwnerID, CategoryID, Title, Description, Address, Price, 
            Latitude, Longitude, CurrentStatus, PublishDate, IsActive)
            VALUES (@PropertyID, @OwnerID, @CategoryID, @Title, @Description, @Address, @Price, @Latitude, @Longitude, 'Available', GETDATE(), 1)
        `;
        propertyRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
        propertyRequest.input('OwnerID', sql.UniqueIdentifier, ownerId);
        propertyRequest.input('CategoryID', sql.Int, categoryId);
        propertyRequest.input('Title', sql.NVarChar, title);
        propertyRequest.input('Description', sql.NVarChar, description);
        propertyRequest.input('Address', sql.NVarChar, address);
        propertyRequest.input('Price', sql.Decimal(12, 2), price);
        propertyRequest.input('Latitude', sql.Decimal(9, 6), latitude);
        propertyRequest.input('Longitude', sql.Decimal(9, 6), longitude);
        await propertyRequest.query(propertyQuery);

        if (imageFiles.length > 0) {
            for (const file of imageFiles) {
                const imageId = crypto.randomUUID();
                const imageUrl = `/uploads/${file.filename}`;
                const imageRequest = new sql.Request(transaction);
                const imageQuery = `
                    INSERT INTO dbo.PropertyImages (ImageID, PropertyID, ImageURL)
                    VALUES (@ImageID, @PropertyID, @ImageURL)
                `;
                imageRequest.input('ImageID', sql.UniqueIdentifier, imageId);
                imageRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
                imageRequest.input('ImageURL', sql.NVarChar(500), imageUrl);
                await imageRequest.query(imageQuery);
            }
        }

        await transaction.commit();

        return res.status(201).json({ message: 'Inmueble creado exitosamente', propertyId });
    } catch (error) {
        console.error('Error en createProperty:', error);
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Error en rollback:', rollbackError);
            }
        }
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const updateProperty = async (req, res = response) => {
    const { currentTitle, title, price, description } = req.body;
    const imageFiles = req.files || [];

    if (!currentTitle || (!title && !price && !description && imageFiles.length === 0)) {
        return res.status(400).json({ error: 'Debe proporcionar el titulo actual y al menos un campo para actualizar' });
    }

    try {
        await poolConnect;

        // Verificar que el PropertyID exista y esté activo
        const verifyRequest = pool.request();
        verifyRequest.input('CurrentTitle', sql.VarChar(150), currentTitle);
        const verifyResult = await verifyRequest.query(`
            SELECT PropertyID 
            FROM dbo.Properties 
            WHERE Title = @CurrentTitle AND IsActive = 1
        `);

        if (!verifyResult.recordset || verifyResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Inmueble no encontrado o inactivo' });
        }
        const propertyId = verifyResult.recordset[0].PropertyID;

        const updates = [];
        const updateRequest = pool.request();
        updateRequest.input('CurrentTitle', sql.VarChar(150), currentTitle);

        if (title !== undefined) {
            updates.push('Title = @Title');
            updateRequest.input('Title', sql.NVarChar, title);
        }
        if (price !== undefined) {
            updates.push('Price = @Price');
            updateRequest.input('Price', sql.Decimal(12, 2), price);
        }
        if (description !== undefined) {
            updates.push('Description = @Description');
            updateRequest.input('Description', sql.NVarChar, description);
        }

        if (updates.length > 0) {
            const updateQuery = `
                UPDATE dbo.Properties 
                SET ${updates.join(', ')}, PublishDate = GETDATE()
                WHERE Title = @CurrentTitle
            `;
            await updateRequest.query(updateQuery);
        }

        // Insertar nuevas imágenes si se proporcionaron
        if (imageFiles.length > 0) {
            for (const file of imageFiles) {
                const imageId = crypto.randomUUID();
                const imageUrl = `/uploads/${file.filename}`;
                const imageRequest = pool.request();
                const imageQuery = `
                    INSERT INTO dbo.PropertyImages (ImageID, PropertyID, ImageURL)
                    VALUES (@ImageID, @PropertyID, @ImageURL)
                `;
                imageRequest.input('ImageID', sql.UniqueIdentifier, imageId);
                imageRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
                imageRequest.input('ImageURL', sql.NVarChar(500), imageUrl);
                await imageRequest.query(imageQuery);
            }
        }

        return res.status(200).json({ message: 'Inmueble actualizado exitosamente', propertyId });
    } catch (error) {
        console.error('Error en updateProperty:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const getPropertyDetails = async (req, res = response) => {
    const { propertyId } = req.query; // Obtenemos el título desde los parámetros de consulta

    if (!propertyId) {
        return res.status(400).json({ error: 'Debe proporcionar un propertyId para buscar el inmueble' });
    }

    try {
        await poolConnect;

        const searchRequest = pool.request();
        searchRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
        const searchResult = await searchRequest.query(`
            SELECT p.PropertyID, p.Title, p.Price, p.Description, p.PublishDate, pi.ImageURL, u.FullName AS ownerName,
                   r.Rating, r.Comment, r.ReviewDate,
                   f.FAQID, f.Question, f.Answer, f.DateAsked
            FROM dbo.Properties p
            LEFT JOIN dbo.PropertyImages pi ON p.PropertyID = pi.PropertyID
            LEFT JOIN dbo.Users u ON p.OwnerID = u.UserID
            LEFT JOIN dbo.Reviews r ON p.PropertyID = r.PropertyID
            LEFT JOIN dbo.FAQs f ON p.PropertyID = f.PropertyID
            WHERE p.PropertyID = @PropertyID AND p.IsActive = 1
        `);

        if (!searchResult.recordset || searchResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Inmueble no encontrado o inactivo' });
        }

        const propertyDetails = {
            propertyId: searchResult.recordset[0].PropertyID,
            title: searchResult.recordset[0].Title,
            price: searchResult.recordset[0].Price,
            description: searchResult.recordset[0].Description,
            publishDate: searchResult.recordset[0].PublishDate,
            ownerName: searchResult.recordset[0].ownerName,
            images: searchResult.recordset
                .filter(row => row.ImageURL !== null) 
                .map(row => row.ImageURL),
            reviews: searchResult.recordset
                .filter(row => row.Rating !== null || row.Comment !== null || row.ReviewDate !== null) 
                .map(row => ({
                    rating: row.Rating,
                    comment: row.Comment,
                    reviewDate: row.ReviewDate
                })),
            faqs: searchResult.recordset
                .filter(row => row.FAQID !== null || row.Question !== null || row.Answer !== null || row.DateAsked !== null) 
                .map(row => ({
                    faqId: row.FAQID,
                    question: row.Question,
                    answer: row.Answer,
                    dateAsked: row.DateAsked
                }))
        };

        return res.status(200).json(propertyDetails);
    } catch (error) {
        console.error('Error en getPropertyDetails:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const createFAQ = async (req, res = response) => {
    const { tenantId, propertyId, question } = req.body;

    // Validación básica de los campos requeridos
    if (!tenantId || !propertyId || !question) {
        return res.status(400).json({ error: 'Todos los campos (tenantId, propertyId, question, dateAsked) son requeridos' });
    }

    try {
        await poolConnect;

        const insertRequest = pool.request();
        const faqId = crypto.randomUUID(); 
        insertRequest.input('FAQID', sql.UniqueIdentifier, faqId);
        insertRequest.input('TenantID', sql.UniqueIdentifier, tenantId);
        insertRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
        insertRequest.input('Question', sql.NVarChar, question);

        const insertQuery = `
            INSERT INTO dbo.FAQs (FAQID, TenantID, PropertyID, Question, DateAsked)
            VALUES (@FAQID, @TenantID, @PropertyID, @Question, GETDATE())
        `;
        await insertRequest.query(insertQuery);

        return res.status(201).json({ message: 'Pregunta creada exitosamente', faqId });
    } catch (error) {
        console.error('Error en createFAQ:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const updateFAQAnswer = async (req, res = response) => {
    const { faqId, answer } = req.body;
   

    // Validación básica de los campos requeridos
    if (!faqId || !answer) {
        return res.status(400).json({ error: 'Todos los campos (faqId, answer) son requeridos' });
    }

    try {
        await poolConnect;

        // Verificar si la pregunta existe
        const checkRequest = pool.request();
        checkRequest.input('FAQID', sql.UniqueIdentifier, faqId);
        const checkResult = await checkRequest.query(`
            SELECT 1 FROM dbo.FAQs WHERE FAQID = @FAQID
        `);
        if (!checkResult.recordset || checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'La pregunta con el FAQID proporcionado no existe' });
        }

        const updateRequest = pool.request();
        updateRequest.input('FAQID', sql.UniqueIdentifier, faqId);
        updateRequest.input('Answer', sql.NVarChar, answer);

        const updateQuery = `
            UPDATE dbo.FAQs
            SET Answer = @Answer
            WHERE FAQID = @FAQID
        `;
        await updateRequest.query(updateQuery);

        return res.status(200).json({ message: 'Respuesta actualizada exitosamente', faqId });
    } catch (error) {
        console.error('Error en updateFAQAnswer:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const createReview = async (req, res = response) => {
    const { tenantId, propertyId, rating, comment } = req.body;

    // Validación básica de los campos requeridos
    if (!tenantId || !propertyId || !rating || !comment) {
        return res.status(400).json({ error: 'Todos los campos (tenantId, propertyId, rating, comment) son requeridos' });
    }

    // Validar que el rating esté entre 1 y 5
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'El rating debe estar entre 1 y 5' });
    }

    try {
        await poolConnect;

        // Verificar si el TenantID existe en dbo.Users
        const tenantCheckRequest = pool.request();
        tenantCheckRequest.input('TenantID', sql.UniqueIdentifier, tenantId);
        const tenantResult = await tenantCheckRequest.query(`
            SELECT 1 FROM dbo.Users WHERE UserID = @TenantID
        `);
        if (!tenantResult.recordset || tenantResult.recordset.length === 0) {
            return res.status(404).json({ error: 'El tenantId proporcionado no existe en la tabla Users' });
        }

        // Verificar si el PropertyID existe en dbo.Properties y está activo
        const propertyCheckRequest = pool.request();
        propertyCheckRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
        const propertyResult = await propertyCheckRequest.query(`
            SELECT 1 FROM dbo.Properties WHERE PropertyID = @PropertyID AND IsActive = 1
        `);
        if (!propertyResult.recordset || propertyResult.recordset.length === 0) {
            return res.status(404).json({ error: 'El propertyId proporcionado no existe o está inactivo' });
        }

        // Insertar la reseña
        const insertRequest = pool.request();
        const reviewId = crypto.randomUUID(); // Generar un ID único para ReviewID
        insertRequest.input('ReviewID', sql.UniqueIdentifier, reviewId);
        insertRequest.input('TenantID', sql.UniqueIdentifier, tenantId);
        insertRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
        insertRequest.input('Rating', sql.Int, rating);
        insertRequest.input('Comment', sql.NVarChar, comment);

        const insertQuery = `
            INSERT INTO dbo.Reviews (ReviewID, TenantID, PropertyID, Rating, Comment, ReviewDate)
            VALUES (@ReviewID, @TenantID, @PropertyID, @Rating, @Comment, GETDATE())
        `;
        await insertRequest.query(insertQuery);

        return res.status(201).json({ message: 'Reseña creada exitosamente', reviewId });
    } catch (error) {
        console.error('Error en createReview:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const createAppointment = async (req, res = response) => {
    const { tenantId, propertyId, visitDateTime } = req.body;

    // Validación básica de los campos requeridos
    if (!tenantId || !propertyId || !visitDateTime) {
        return res.status(400).json({ error: 'Todos los campos (tenantId, propertyId, visitDateTime) son requeridos' });
    }

    try {
        await poolConnect;

        // Verificar si el TenantID existe en dbo.Users
        const tenantCheckRequest = pool.request();
        tenantCheckRequest.input('TenantID', sql.UniqueIdentifier, tenantId);
        const tenantResult = await tenantCheckRequest.query(`
            SELECT 1 FROM dbo.Users WHERE UserID = @TenantID
        `);
        if (!tenantResult.recordset || tenantResult.recordset.length === 0) {
            return res.status(404).json({ error: 'El tenantId proporcionado no existe en la tabla Users' });
        }

        // Verificar si el PropertyID existe en dbo.Properties y está activo
        const propertyCheckRequest = pool.request();
        propertyCheckRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
        const propertyResult = await propertyCheckRequest.query(`
            SELECT 1 FROM dbo.Properties WHERE PropertyID = @PropertyID AND IsActive = 1
        `);
        if (!propertyResult.recordset || propertyResult.recordset.length === 0) {
            return res.status(404).json({ error: 'El propertyId proporcionado no existe o está inactivo' });
        }

        // Insertar la cita
        const insertRequest = pool.request();
        const appointmentId = crypto.randomUUID(); // Generar un ID único para AppointmentID
        insertRequest.input('AppointmentID', sql.UniqueIdentifier, appointmentId);
        insertRequest.input('TenantID', sql.UniqueIdentifier, tenantId);
        insertRequest.input('PropertyID', sql.UniqueIdentifier, propertyId);
        insertRequest.input('VisitDateTime', sql.DateTime, new Date(visitDateTime)); // Convertir a DateTime
        insertRequest.input('Status', sql.NVarChar(20), 'Pending'); // Establecer Status como "On wait"

        const insertQuery = `
            INSERT INTO dbo.Appointments (AppointmentID, TenantID, PropertyID, VisitDateTime, Status)
            VALUES (@AppointmentID, @TenantID, @PropertyID, @VisitDateTime, @Status)
        `;
        await insertRequest.query(insertQuery);

        return res.status(201).json({ message: 'Cita creada exitosamente', appointmentId });
    } catch (error) {
        console.error('Error en createAppointment:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const updateAppointmentStatus = async (req, res = response) => {
    const { appointmentId, status } = req.body;

    // Validación básica de los campos requeridos
    if (!appointmentId || !status) {
        return res.status(400).json({ error: 'Todos los campos (appointmentId, status) son requeridos' });
    }

    try {
        await poolConnect;

        // Verificar si la cita existe
        const checkRequest = pool.request();
        checkRequest.input('AppointmentID', sql.UniqueIdentifier, appointmentId);
        const checkResult = await checkRequest.query(`
            SELECT 1 FROM dbo.Appointments WHERE AppointmentID = @AppointmentID
        `);
        if (!checkResult.recordset || checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'La cita con el AppointmentID proporcionado no existe' });
        }

        // Actualizar el estado
        const updateRequest = pool.request();
        updateRequest.input('AppointmentID', sql.UniqueIdentifier, appointmentId);
        updateRequest.input('Status', sql.NVarChar(50), status);

        const updateQuery = `
            UPDATE dbo.Appointments
            SET Status = @Status
            WHERE AppointmentID = @AppointmentID
        `;
        await updateRequest.query(updateQuery);

        return res.status(200).json({ message: `Estado de la cita actualizado a ${status} exitosamente`, appointmentId });
    } catch (error) {
        console.error('Error en updateAppointmentStatus:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const getAppointments = async (req, res = response) => {
    try {
        await poolConnect;

        const queryRequest = pool.request();
        const query = `
            SELECT 
                a.AppointmentID,
                a.Status,
                u.FullName,
                u.Phone,
                ac.Email,
                a.VisitDateTime AS VisitDate
            FROM dbo.Appointments a
            INNER JOIN dbo.Users u ON a.TenantID = u.UserID
            INNER JOIN dbo.Accounts ac ON u.AccountID = ac.AccountID
            WHERE ac.IsActive = 1
        `;
        const result = await queryRequest.query(query);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ error: 'No se encontraron citas' });
        }

        const appointments = result.recordset.map(row => ({
            appointmentId: row.AppointmentID,
            status: row.Status,
            fullName: row.FullName,
            phone: row.Phone,
            email: row.Email,
            visitDate: row.VisitDate
        }));

        return res.status(200).json(appointments);
    } catch (error) {
        console.error('Error en getAppointments:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    getProperties,
    createProperty,
    updateProperty,
    getPropertyDetails,
    createFAQ,
    updateFAQAnswer,
    createReview,
    createAppointment,
    updateAppointmentStatus,
    getAppointments
};