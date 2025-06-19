const { response } = require('express');
const { pool, poolConnect, sql } = require('../../business/models/database');
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const { get } = require('http');
require("dotenv").config();

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
    getContracts,
    createPayment
};