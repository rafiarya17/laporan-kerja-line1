using System;
using System.Runtime.InteropServices;
using System.Text;

// Client-only DDE connection to the two Champer call indicators.
public static class ChamperSignals {
    delegate IntPtr Callback(uint type, uint format, IntPtr conversation, IntPtr a, IntPtr b, IntPtr data, UIntPtr x, UIntPtr y);
    static readonly Callback callback = delegate { return IntPtr.Zero; };
    [DllImport("user32", EntryPoint="DdeInitializeA")] static extern uint Init(ref uint id, Callback cb, uint flags, uint reserved);
    [DllImport("user32", EntryPoint="DdeCreateStringHandleA")] static extern IntPtr Handle(uint id, string value, int codePage);
    [DllImport("user32")] static extern bool DdeFreeStringHandle(uint id, IntPtr handle);
    [DllImport("user32")] static extern IntPtr DdeConnect(uint id, IntPtr service, IntPtr topic, IntPtr context);
    [DllImport("user32")] static extern bool DdeDisconnect(IntPtr conversation);
    [DllImport("user32")] static extern bool DdeUninitialize(uint id);
    [DllImport("user32")] static extern IntPtr DdeClientTransaction(IntPtr data, uint length, IntPtr conversation, IntPtr item, uint format, uint type, uint timeout, out uint result);
    [DllImport("user32")] static extern uint DdeGetData(IntPtr data, byte[] buffer, uint length, uint offset);
    [DllImport("user32")] static extern bool DdeFreeDataHandle(IntPtr data);
    static string ReadBit(IntPtr conversation, IntPtr item) {
        uint result;
        // XTYP_REQUEST / CF_TEXT. No write transaction is exposed.
        IntPtr data=DdeClientTransaction(IntPtr.Zero,0,conversation,item,1,0x20b0,1200,out result);
        if(data==IntPtr.Zero)return "?";
        try {
            byte[] bytes=new byte[32];
            uint length=DdeGetData(data,bytes,(uint)bytes.Length,0);
            if(length==0 || length>=bytes.Length)return "?";
            string value=Encoding.ASCII.GetString(bytes,0,(int)length).TrimEnd('\0','\r','\n',' ','\t');
            return value=="0"||value=="1"?value:"?";
        } finally { DdeFreeDataHandle(data); }
    }
    public static void Run() {
        uint id=0;
        if(Init(ref id,callback,0x10,0)!=0)return;
        IntPtr service=Handle(id,"DXP",1004),topic=Handle(id,"Device1",1004);
        IntPtr mtc=Handle(id,"D102",1004),dandori=Handle(id,"D104",1004);
        try {
            while(Console.ReadLine()!=null){
                IntPtr conversation=DdeConnect(id,service,topic,IntPtr.Zero);
                string bits="? ?";
                if(conversation!=IntPtr.Zero){
                    try { bits=ReadBit(conversation,mtc)+" "+ReadBit(conversation,dandori); }
                    finally { DdeDisconnect(conversation); }
                }
                Console.WriteLine(bits);
                Console.Out.Flush();
            }
        } finally {
            foreach(IntPtr h in new[]{mtc,dandori,topic,service})DdeFreeStringHandle(id,h);
            DdeUninitialize(id);
        }
    }
}
