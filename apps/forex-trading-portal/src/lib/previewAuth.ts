import { useState } from 'react';
const previewUser={id:'preview-client',name:'BIGBULLS Client',email:'client@bigbulls.example'};
export function useAuth(){return {user:previewUser,isLoading:false};}
export function loginWithRedirect(){}
export function logout(){window.location.reload();}
export function useLocalUpload(){const [isUploading,setIsUploading]=useState(false);const upload=async(file:File)=>{setIsUploading(true);try{return {url:URL.createObjectURL(file)};}finally{setIsUploading(false);}};return {upload,isUploading};}
