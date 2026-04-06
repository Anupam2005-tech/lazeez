const { z } = require('zod');

const tokenSchema = {
  body: z.object({
    idToken: z.string().min(1, "Token is required")
  })
};

const profileSchema = {
  body: z.object({
    name: z.string().min(1, "Name is required").max(100).optional(),
    phone: z.string().min(10, "Valid phone is required").max(15).optional(),
    email: z.string().email("Valid email is required").max(100).optional(),
    flatNo: z.string().max(100).optional(),
    landmark: z.string().max(100).optional(),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits").optional().or(z.literal('')),
    address: z.string().max(255).optional(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable()
  })
};

module.exports = { tokenSchema, profileSchema };
