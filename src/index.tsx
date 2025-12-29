// index.tsx（TypeScript）
import React from 'react';
import ReactDOM from 'react-dom'; // 注意：直接导入 react-dom，而非 react-dom/client
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root') as HTMLElement // TypeScript 类型断言保留
);

// 性能监控代码不变
reportWebVitals();