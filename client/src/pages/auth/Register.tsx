import React from 'react';
import { Navigate } from 'react-router-dom';

export const RegisterPage: React.FC = () => <Navigate to="/login" replace />;

export default RegisterPage;
