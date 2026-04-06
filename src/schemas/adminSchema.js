const { z } = require('zod');

const categorySchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 chars").max(50)
  })
};

const menuItemSchema = {
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 chars").max(100),
    description: z.string().max(500).optional(),
    price: z.preprocess((val) => parseFloat(val), z.number().positive("Price must be positive")),
    categoryId: z.string().min(1, "Category ID is required"),
    available: z.preprocess((val) => val === 'true' || val === 'on', z.boolean()).optional(),
    isVeg: z.preprocess((val) => val === 'true' || val === 'on', z.boolean()).optional(),
    isBestSeller: z.preprocess((val) => val === 'true' || val === 'on', z.boolean()).optional()
  })
};

module.exports = { categorySchema, menuItemSchema };
