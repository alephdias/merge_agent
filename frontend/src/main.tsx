import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Empresas } from './pages/Empresas';
import { EmpresaDetalhe } from './pages/EmpresaDetalhe';
import { BibliotecaTotvs } from './pages/BibliotecaTotvs';
import { FontesEmpresa } from './pages/FontesEmpresa';
import { NovoMerge } from './pages/NovoMerge';
import { HistoricoMerges } from './pages/HistoricoMerges';
import { RelatorioMerge } from './pages/RelatorioMerge';
import { ComparativoTotvs } from './pages/ComparativoTotvs';

const root = document.getElementById('root');
if (!root) throw new Error('Root element não encontrado');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><Empresas /></ProtectedRoute>} />
        <Route path="/empresas/:id" element={<ProtectedRoute><EmpresaDetalhe /></ProtectedRoute>} />
        <Route path="/empresas/:id/fontes" element={<ProtectedRoute><FontesEmpresa /></ProtectedRoute>} />
        <Route path="/totvs" element={<ProtectedRoute><BibliotecaTotvs /></ProtectedRoute>} />
        <Route path="/totvs/comparativo" element={<ProtectedRoute><ComparativoTotvs /></ProtectedRoute>} />
        <Route path="/merges" element={<ProtectedRoute><HistoricoMerges /></ProtectedRoute>} />
        <Route path="/merges/novo" element={<ProtectedRoute><NovoMerge /></ProtectedRoute>} />
        <Route path="/merges/:id/relatorio" element={<ProtectedRoute><RelatorioMerge /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
