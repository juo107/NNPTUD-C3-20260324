const express = require('express');
const router = express.Router();
const fs = require('fs');
const { importUsersFromExcel } = require('../utils/userImport');
const { uploadExcel } = require('../utils/uploadHandler');

/**
 * POST /api/v1/import/users
 * Trigger the user import from an uploaded Excel file
 */
router.post('/users', uploadExcel.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Vui lòng upload file Excel" });
        }

        const filePath = req.file.path;
        console.log(`Starting import from uploaded file: ${filePath}`);
        
        const result = await importUsersFromExcel(filePath);
        
        // Dọn dẹp file sau khi import xong
        fs.unlinkSync(filePath);

        res.status(200).json({
            message: "Import process completed",
            details: result
        });
    } catch (error) {
        console.error("Import process failed:", error);
        res.status(500).json({
            message: "Import process failed",
            error: error.message
        });
    }
});

module.exports = router;
