const ExcelJS = require('exceljs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const userModel = require('../schemas/users');
const roleModel = require('../schemas/roles');
const cartModel = require('../schemas/carts');
const { sendMail } = require('./sendMail');

/**
 * Generate a random password that meets the project's strong password requirements:
 * 8+ chars, 1+ uppercase, 1+ lowercase, 1+ number, 1+ symbols.
 */
function generateRandomPassword(length = 16) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    
    // Ensure we have at least one of each required type
    password += "A"; // Uppercase
    password += "a"; // Lowercase
    password += "1"; // Number
    password += "!"; // Symbol
    
    for (let i = 4; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

async function getOrCreateUserRole() {
    let role = await roleModel.findOne({ name: { $regex: /user/i } });
    if (!role) {
        console.log("User role not found, creating it...");
        role = new roleModel({
            name: "user",
            description: "Default user role"
        });
        await role.save();
    }
    return role;
}

module.exports = {
    importUsersFromExcel: async function (filePath) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        const role = await getOrCreateUserRole();
        
        // Iterate over rows starting from Row 2
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const username = row.getCell(1).value; // Column A
            const emailCell = row.getCell(2).value; // Column B

            if (!username || !emailCell) {
                console.log(`Skipping row ${i}: username or emailCell is missing`);
                continue;
            }

            let email;
            if (typeof emailCell === 'object' && emailCell !== null) {
                email = emailCell.result || emailCell.text || (emailCell.richText ? emailCell.richText.map(t => t.text).join('') : null);
            } else {
                email = emailCell;
            }

            if (!email) {
                console.log(`Skipping row ${i}: email is null after extraction`);
                continue;
            }

            const password = generateRandomPassword(16);
            
            try {
                // Check if user already exists
                const existingUser = await userModel.findOne({ $or: [{ username }, { email }] });
                if (existingUser) {
                    results.failed++;
                    results.errors.push({ username, error: `User ${username} or email ${email} already exists` });
                    continue;
                }

                // Create User
                const newUser = new userModel({
                    username,
                    email,
                    password, // pre-save hook in users.js handles hashing
                    role: role._id,
                    status: true
                });
                await newUser.save();

                // Create Cart (as required by project logic)
                const newCart = new cartModel({
                    user: newUser._id
                });
                await newCart.save();
                
                // Send email notification (outside to avoid blocking)
                await sendMail(
                    email,
                    "Your Account Information",
                    `Hello ${username},\n\nYour account has been created. Your password is: ${password}\n\nPlease change it after logging in.`,
                    `<p>Hello <b>${username}</b>,</p><p>Your account has been created.</p><p>Your password is: <code>${password}</code></p><p>Please change it after logging in.</p>`
                );

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({ username, error: error.message });
                console.error(`Error importing user ${username}:`, error.message);
            }
        }

        return results;
    }
};
