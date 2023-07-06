// In this app, we are trying to add the subscription selector into the existing parent theme forms.
const cart_add_forms = document.querySelectorAll('form[action="/cart/add"]');
cart_add_forms.forEach((form) => {
    console.log(`cart_add_forms: ${form.innerHTML}`);
    // Adding the subscription options to the existing form.
    const selling_plan_input = document.createElement('input');
    selling_plan_input.type = 'hidden';
    selling_plan_input.name = 'selling_plan';
    selling_plan_input.value = '';
    form.appendChild(selling_plan_input);
});

// Each plan click set its value to all selling_plan inputs.
// onClick event for this function is defined in 'blocks/app-block.liquid'.
const radio_click = (obj) => {
    const selling_plan_inputs = document.querySelectorAll('input[name="selling_plan"]');
    selling_plan_inputs.forEach((input) => {
        input.value = obj.value;
    });
};
