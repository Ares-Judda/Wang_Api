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
    const { title } = req.query; // Obtenemos el título desde los parámetros de consulta

    if (!title) {
        return res.status(400).json({ error: 'Debe proporcionar un título para buscar el inmueble' });
    }

    try {
        await poolConnect;

        const searchRequest = pool.request();
        searchRequest.input('Title', sql.VarChar(150), title.trim());
        const searchResult = await searchRequest.query(`
            SELECT p.PropertyID, p.Title, p.Price, p.Description, p.PublishDate, pi.ImageURL, u.FullName AS ownerName,
                   r.Rating, r.Comment, r.ReviewDate
            FROM dbo.Properties p
            LEFT JOIN dbo.PropertyImages pi ON p.PropertyID = pi.PropertyID
            LEFT JOIN dbo.Users u ON p.OwnerID = u.UserID
            LEFT JOIN dbo.Reviews r ON p.PropertyID = r.PropertyID
            WHERE p.Title = @Title AND p.IsActive = 1
        `);

        if (!searchResult.recordset || searchResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Inmueble no encontrado o inactivo' });
        }

        // Agrupar las imágenes por inmueble y añadir el nombre del propietario
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
                .filter(row => row.Rating !== null || row.Comment !== null || row.ReviewDate !== null) // Filtrar solo filas con reseñas
                .map(row => ({
                    rating: row.Rating,
                    comment: row.Comment,
                    reviewDate: row.ReviewDate
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

const getContracts = async (req, res = response) => {
    try {
        await poolConnect;

        const queryRequest = pool.request();
        const query = `
            SELECT c.ContractFile, c.StartDate, c.EndDate, p.Title
            FROM dbo.Contracts c
            INNER JOIN dbo.Appointments a ON c.AppointmentID = a.AppointmentID
            INNER JOIN dbo.Properties p ON a.PropertyID = p.PropertyID
            WHERE p.IsActive = 1
        `;
        const result = await queryRequest.query(query);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ error: 'No se encontraron contratos' });
        }

        const contracts = result.recordset.map(row => ({
            contractFile: row.ContractFile,
            startDate: row.StartDate,
            endDate: row.EndDate,
            title: row.Title
        }));

        return res.status(200).json(contracts);
    } catch (error) {
        console.error('Error en getContracts:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const createPayment = async (req, res = response) => {
    const { contractId, paymentMethod, amount } = req.body;

    // Validación básica de los campos requeridos
    if (!contractId || !paymentMethod || !amount) {
        return res.status(400).json({ error: 'Todos los campos (contractId, paymentMethod, amount, paymentDate) son requeridos' });
    }

    try {
        await poolConnect;

        // Verificar si el ContractID existe en dbo.Contracts
        const checkRequest = pool.request();
        checkRequest.input('ContractID', sql.UniqueIdentifier, contractId);
        const checkResult = await checkRequest.query(`
            SELECT 1 FROM dbo.Contracts WHERE ContractID = @ContractID
        `);
        if (!checkResult.recordset || checkResult.recordset.length === 0) {
            return res.status(404).json({ error: 'El ContractID proporcionado no existe' });
        }

        // Insertar el pago
        const insertRequest = pool.request();
        const paymentId = crypto.randomUUID(); 
        insertRequest.input('PaymentID', sql.UniqueIdentifier, paymentId);
        insertRequest.input('ContractID', sql.UniqueIdentifier, contractId);
        insertRequest.input('PaymentMethod', sql.NVarChar(50), paymentMethod);
        insertRequest.input('Amount', sql.Decimal(12, 2), amount);

        const insertQuery = `
            INSERT INTO dbo.Payments (PaymentID, ContractID, PaymentMethod, Amount, PaymentDate)
            VALUES (@PaymentID, @ContractID, @PaymentMethod, @Amount, GETDATE())
        `;
        await insertRequest.query(insertQuery);

        return res.status(201).json({ message: 'Pago creado exitosamente', paymentId });
    } catch (error) {
        console.error('Error en createPayment:', error);
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
    getContracts,
    createPayment
};