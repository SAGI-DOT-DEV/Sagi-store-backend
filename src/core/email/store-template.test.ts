import { describe, expect, it } from 'vitest';
import { storeEmail, emailParagraph } from './store-template.js';
import { orderEmailTemplate } from './order-template.js';

const order = { id: 'order-1', currency: 'CAD', subtotal: 40, shippingAmount: 5, total: 45, items: [{ name: 'Yam flour & rice', quantity: 2, unitPrice: 20 }] };
describe('SAGI mail templates', () => {
  it('uses pure white surfaces and a monochrome palette', () => {
    const result = orderEmailTemplate({appUrl:'https://store.test',status:'PAID',order});
    expect(result.html).toContain('background:#FFFFFF');
    expect(result.html).toContain('bgcolor="#000000"');
    const colors = result.html.match(/#[0-9a-f]{6}\b/gi) || [];
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) {
      expect(['#FFFFFF', '#000000', '#E5E5E5', '#D4D4D4', '#525252', '#737373']).toContain(color);
    }
  });
  it('escapes customer content and uses a readable logo with absolute links', () => {
    const result = storeEmail({appUrl:'https://store.test',title:'Welcome',preview:'Confirm email',firstName:'<img src=x>',body:emailParagraph('<script>bad</script>'),text:'Confirm email',action:{label:'Confirm email',url:'https://store.test/verify-email?token=a&type=user'}});
    expect(result.html).toContain('&lt;img src=x&gt;');
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('alt="SAGI"');
    expect(result.html).toContain('https://store.test/Asset%201%20(1).png');
    expect(result.html).toContain('token=a&amp;type=user');
    expect(result.text).toContain('token=a&type=user');
  });
  it('includes item names, quantity, unit prices and accurate totals', () => {
    const result=orderEmailTemplate({appUrl:'https://store.test',status:'PAID',order});
    expect(result.html).toContain('Yam flour &amp; rice');
    expect(result.html).toContain('Quantity: 2');
    expect(result.html).toContain('CAD 20.00 each');
    expect(result.text).toContain('Total paid: CAD 45.00');
    expect(result.text).toContain('\n');
    expect(result.text).not.toContain('\\n');
  });
  it('links delivered orders to reviews without next-step or updated sections', () => {
    const result=orderEmailTemplate({appUrl:'https://store.test',status:'DELIVERED',order});
    expect(result.html).toContain('Leave a review');
    expect(result.html).toContain('/review?orderId=order-1');
    expect(result.html).not.toContain('Next step');
    expect(result.subject).toBe('Delivered to your door — SAGI');
  });
  it('styles every supported order status without claiming pending payments are paid', () => {
    for(const status of ['PAID','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','REFUNDED','PAYMENT_PROCESSING','PAYMENT_REVIEW_REQUIRED']) {
      const result=orderEmailTemplate({appUrl:'https://store.test',status,order});
      expect(result.html).toContain('alt="SAGI"');
      if(status!=='PAID') expect(result.text).not.toContain('Total paid');
    }
  });
});
