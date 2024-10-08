/* eslint-disable node/no-unpublished-import */
/* eslint-disable security/detect-possible-timing-attacks */
import * as dotenv from 'dotenv';
dotenv.config();
import {Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import config from '../config/config';
import db from '../sequelize-client';
import { MyUserRequest } from '../types/request-interface';
import ApiError from '../utils/api-error';
import asyncHandler from '../utils/async-handler';
import encryption from '../utils/encryption';

export const verifyToken = asyncHandler(
  async (req: MyUserRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(
        new ApiError(401, 'Unauthorized - Token not found'),
      );
    }

    try {
      const decoded = jwt.verify(token, config.JWT.SECRET as string) as {
                userId: string;
            };

      const encryptedToken = await db.AccessToken.findOne({
        where: {
          userId: decoded.userId,
          tokenType: 'ACCESS',
        },
      });

      if (!encryptedToken) {
        return next(
          new ApiError(
            401,
            'Unauthorized - Token not found or expired',
          ),
        );
      }

      const decryptedToken = encryption.decryptWithAES(
        encryptedToken.token,
      );

      if (decryptedToken !== token) {
        return next(new ApiError(401, 'Unauthorized - Token mismatch'));
      }

      const user = await db.User.findOne({
        where: { id: decoded.userId },
      });

      if (!user) {
        return next(
          new ApiError(401, 'Unauthorized - User not found'),
        );
      }

      req.token = token;
      req.user = user;
      next();
    } catch (error) {
      console.log(error);
      return next(new ApiError(401, 'Unauthorized - Invalid token'));
    }
  },
);
