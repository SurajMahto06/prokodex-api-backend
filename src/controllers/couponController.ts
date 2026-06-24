import { Request, Response } from 'express';
import { prisma } from '../utils/db';

export const getCoupons = async (req: Request, res: Response) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(coupons);
  } catch (error) {
    console.error('getCoupons error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const { code, type, value, isActive } = req.body;

    if (!code || !type || value === undefined) {
      return res.status(400).json({ message: 'Code, type, and value are required' });
    }

    const upperCode = code.toUpperCase();

    const existing = await prisma.coupon.findUnique({ where: { code: upperCode } });
    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: upperCode,
        type,
        value,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json(coupon);
  } catch (error) {
    console.error('createCoupon error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { code, type, value, isActive } = req.body;

    const data: any = {};
    if (code) data.code = code.toUpperCase();
    if (type) data.type = type;
    if (value !== undefined) data.value = value;
    if (isActive !== undefined) data.isActive = isActive;

    const coupon = await prisma.coupon.update({
      where: { id },
      data
    });

    res.status(200).json(coupon);
  } catch (error) {
    console.error('updateCoupon error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.coupon.delete({ where: { id } });
    res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('deleteCoupon error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const verifyCoupon = async (req: Request, res: Response) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const upperCode = couponCode.toUpperCase();
    const coupon = await prisma.coupon.findUnique({
      where: { code: upperCode }
    });

    if (!coupon || !coupon.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon code.' });
    }

    res.status(200).json({
      success: true,
      discountAmount: coupon.value,
      type: coupon.type,
      message: 'Coupon applied successfully'
    });
  } catch (error) {
    console.error('verifyCoupon error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
