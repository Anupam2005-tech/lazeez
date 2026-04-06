const { z } = require('zod');

const placeOrderSchema = {
  body: z.object({
    dineIn: z.enum(['true', 'false', 'on', 'off']).optional(),
    address: z.string().max(255).optional(),
    customerName: z.string().min(1, "Name is required").max(100).optional(),
    customerPhone: z.string().min(10, "Valid phone is required").max(15).optional(),
    paymentMethod: z.enum(['Online']).default('Online')
  }).refine((data) => {
    const isDineIn = data.dineIn === 'true' || data.dineIn === 'on';
    if (!isDineIn && (!data.address || data.address.trim().length === 0)) {
      return false;
    }
    return true;
  }, {
    message: "Address is required for delivery",
    path: ["address"]
  })
};

const updateStatusSchema = {
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    status: z.enum(['Pending', 'Preparing', 'Ready', 'Delivered', 'Cancelled'])
  })
};

const cancelOrderSchema = {
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    cancelReason: z.string().max(255, "Reason too long").optional()
  })
};

module.exports = { placeOrderSchema, updateStatusSchema, cancelOrderSchema };
