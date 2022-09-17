import React from 'react';
import {
  act as actComponent,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { act, renderHook } from '@testing-library/react-hooks';

import { VALIDATION_MODE } from '../constants';
import {
  Control,
  RegisterOptions,
  UseFormRegister,
  UseFormReturn,
} from '../types';
import isFunction from '../utils/isFunction';
import { Controller, useFieldArray, useForm } from '../';

describe('useForm', () => {
  describe('when component unMount', () => {
    it('should call unSubscribe', () => {
      const { result, unmount } = renderHook(() => useForm<{ test: string }>());

      result.current.register('test');
      unmount();

      expect(result.current.getValues()).toEqual({});
    });

    it('should remain array field values when inputs gets unmounted', () => {
      const { result, unmount } = renderHook(() =>
        useForm<{ test: string[] }>(),
      );

      result.current.register('test.0');
      result.current.register('test.1');
      result.current.register('test.2');

      unmount();

      expect(result.current.getValues()).toEqual({
        test: [undefined, undefined, undefined],
      });
    });

    it('should not unregister errors when unmounted', async () => {
      const { result, unmount } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );

      result.current.formState.errors;
      result.current.register('test', { required: true });

      await act(async () => {
        await result.current.handleSubmit(() => {})({
          preventDefault: () => {},
          persist: () => {},
        } as React.SyntheticEvent);
      });

      expect(result.current.formState.errors.test).toBeDefined();

      unmount();

      expect(result.current.formState.errors.test).toBeDefined();
    });

    it('should only unregister errors when unregister method invoked', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );

      result.current.formState.errors;
      result.current.register('test', { required: true });

      await act(async () => {
        await result.current.handleSubmit(() => {})({
          preventDefault: () => {},
          persist: () => {},
        } as React.SyntheticEvent);
      });

      expect(result.current.formState.errors.test).toBeDefined();

      await act(async () => {
        result.current.unregister('test');
      });

      expect(result.current.formState.errors.test).not.toBeDefined();
    });

    it('should not unregister touched', () => {
      let formState: any;
      const Component = () => {
        const { register, formState: tempFormState } = useForm<{
          test: string;
        }>();
        formState = tempFormState;

        formState.touchedFields;

        return (
          <div>
            <input {...register('test', { required: true })} />
          </div>
        );
      };
      const { unmount } = render(<Component />);

      fireEvent.blur(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      expect(formState.touchedFields.test).toBeDefined();
      expect(formState.isDirty).toBeFalsy();

      unmount();

      expect(formState.touchedFields.test).toBeDefined();
      expect(formState.isDirty).toBeFalsy();
    });

    it('should update dirtyFields during unregister', () => {
      let formState: any;
      const Component = () => {
        const { register, formState: tempFormState } = useForm<{
          test: string;
        }>();
        formState = tempFormState;

        formState.isDirty;
        formState.dirtyFields;

        return <input {...register('test', { required: true })} />;
      };
      const { unmount } = render(<Component />);

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      expect(formState.dirtyFields.test).toBeDefined();
      expect(formState.isDirty).toBeTruthy();

      unmount();

      expect(formState.dirtyFields.test).toBeDefined();
      expect(formState.isDirty).toBeTruthy();
    });

    it('should only validate input which are mounted even with shouldUnregister: false', async () => {
      const Component = () => {
        const [show, setShow] = React.useState(true);
        const {
          handleSubmit,
          register,
          formState: { errors },
        } = useForm<{
          firstName: string;
          lastName: string;
        }>();

        return (
          <form onSubmit={handleSubmit(() => {})}>
            {show && <input {...register('firstName', { required: true })} />}
            {errors.firstName && <p>First name is required.</p>}

            <input {...register('lastName', { required: true })} />
            {errors.lastName && <p>Last name is required.</p>}

            <button type={'button'} onClick={() => setShow(!show)}>
              toggle
            </button>
            <button type={'submit'}>submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      expect(await screen.findByText('First name is required.')).toBeVisible();
      expect(screen.getByText('Last name is required.')).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      expect(screen.getByText('Last name is required.')).toBeVisible();

      await waitForElementToBeRemoved(
        screen.queryByText('First name is required.'),
      );
    });
  });

  describe('when shouldUnregister set to true', () => {
    describe('with useFieldArray', () => {
      type FormValues = {
        test: string;
        test1: string;
        test2: {
          value: string;
        }[];
      };

      const Child = ({
        control,
        register,
      }: {
        control: Control<FormValues>;
        register: UseFormRegister<FormValues>;
      }) => {
        const { fields } = useFieldArray({
          control,
          name: 'test2',
          shouldUnregister: true,
        });

        return (
          <>
            {fields.map((field, i) => (
              <input
                key={field.id}
                {...register(`test2.${i}.value` as const)}
              />
            ))}
          </>
        );
      };

      it('should remove and unregister inputs when inputs gets unmounted', async () => {
        let submittedData: FormValues;

        const Component = () => {
          const [show, setShow] = React.useState(true);
          const { register, handleSubmit, control } = useForm<FormValues>({
            shouldUnregister: true,
            defaultValues: {
              test: 'bill',
              test1: 'bill1',
              test2: [{ value: 'bill2' }],
            },
          });

          return (
            <form onSubmit={handleSubmit((data) => (submittedData = data))}>
              {show && (
                <>
                  <input {...register('test')} />
                  <Controller
                    control={control}
                    render={({ field }) => <input {...field} />}
                    name={'test1'}
                  />
                  <Child control={control} register={register} />
                </>
              )}
              <button>Submit</button>
              <button type={'button'} onClick={() => setShow(false)}>
                Toggle
              </button>
            </form>
          );
        };

        render(<Component />);

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() =>
          expect(submittedData).toEqual({
            test: 'bill',
            test1: 'bill1',
            test2: [
              {
                value: 'bill2',
              },
            ],
          }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() => expect(submittedData).toEqual({}));
      });
    });

    it('should not mutate defaultValues', () => {
      const defaultValues = {
        test: {
          test: '123',
          test1: '1234',
        },
      };

      const Form = () => {
        const { register, control } = useForm({
          defaultValues,
        });
        return (
          <>
            <input {...register('test.test', { shouldUnregister: true })} />
            <Controller
              control={control}
              shouldUnregister
              render={() => {
                return <input />;
              }}
              name={'test.test1'}
            />
          </>
        );
      };

      const App = () => {
        const [show, setShow] = React.useState(true);
        return (
          <>
            {show && <Form />}
            <button
              type={'button'}
              onClick={() => {
                setShow(!show);
              }}
            >
              toggle
            </button>
          </>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button'));

      fireEvent.click(screen.getByRole('button'));

      fireEvent.click(screen.getByRole('button'));

      expect(defaultValues).toEqual({
        test: {
          test: '123',
          test1: '1234',
        },
      });
    });

    it('should not register or shallow defaultValues into submission data', () => {
      let data = {};

      const App = () => {
        const { handleSubmit } = useForm({
          defaultValues: {
            test: 'test',
          },
        });

        return (
          <button
            onClick={handleSubmit((d) => {
              data = d;
            })}
          >
            sumbit
          </button>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button'));

      expect(data).toEqual({});
    });

    it('should keep validation during unmount', async () => {
      const onSubmit = jest.fn();

      function Component() {
        const {
          register,
          handleSubmit,
          watch,
          formState: { errors, submitCount },
        } = useForm<{
          firstName: string;
          moreDetail: boolean;
        }>({
          shouldUnregister: true,
        });
        const moreDetail = watch('moreDetail');

        return (
          <>
            <p>Submit count: {submitCount}</p>
            <form onSubmit={handleSubmit(onSubmit)}>
              <input
                placeholder="firstName"
                {...register('firstName', { maxLength: 3 })}
              />
              {errors.firstName && <p>max length</p>}
              <input
                type="checkbox"
                {...register('moreDetail')}
                placeholder={'checkbox'}
              />

              {moreDetail && <p>show more</p>}
              <button>Submit</button>
            </form>
          </>
        );
      }

      render(<Component />);

      fireEvent.change(screen.getByPlaceholderText('firstName'), {
        target: {
          value: 'testtesttest',
        },
      });

      fireEvent.click(screen.getByRole('button'));

      expect(await screen.findByText('Submit count: 1')).toBeVisible();
      expect(screen.getByText('max length')).toBeVisible();

      fireEvent.click(screen.getByPlaceholderText('checkbox'));

      expect(screen.getByText('show more')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      expect(await screen.findByText('Submit count: 2')).toBeVisible();
      expect(screen.getByText('max length')).toBeVisible();
    });

    it('should only unregister inputs when all checkboxes are unmounted', async () => {
      let result: Record<string, string> | undefined = undefined;

      const Component = () => {
        const { register, handleSubmit } = useForm({
          shouldUnregister: true,
        });
        const [radio1, setRadio1] = React.useState(true);
        const [radio2, setRadio2] = React.useState(true);

        return (
          <form
            onSubmit={handleSubmit((data) => {
              result = data;
            })}
          >
            {radio1 && (
              <input {...register('test')} type={'radio'} value={'1'} />
            )}
            {radio2 && (
              <input {...register('test')} type={'radio'} value={'2'} />
            )}
            <button type={'button'} onClick={() => setRadio1(!radio1)}>
              setRadio1
            </button>
            <button type={'button'} onClick={() => setRadio2(!radio2)}>
              setRadio2
            </button>
            <button>Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'setRadio1' }));

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => expect(result).toEqual({ test: null }));

      fireEvent.click(screen.getByRole('button', { name: 'setRadio2' }));

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => expect(result).toEqual({}));
    });
  });

  describe('when errors changes', () => {
    it('should display the latest error message', async () => {
      const Form = () => {
        const {
          register,
          setError,
          formState: { errors },
        } = useForm<{
          test: string;
        }>();

        React.useEffect(() => {
          setError('test', {
            type: 'data',
            message: 'data',
          });
        }, [setError]);

        return (
          <div>
            <input
              {...register('test', {
                maxLength: {
                  message: 'max',
                  value: 3,
                },
              })}
              placeholder="test"
              type="text"
            />
            <span role="alert">{errors.test && errors.test.message}</span>
          </div>
        );
      };

      render(<Form />);

      const span = screen.getByRole('alert');

      await waitFor(() => expect(span.textContent).toBe('data'));

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      await waitFor(() => expect(span.textContent).toBe('data'));
    });
  });

  describe('handleChangeRef', () => {
    const Component = ({
      resolver,
      mode,
      rules = { required: 'required' },
      onSubmit = () => {},
    }: {
      resolver?: any;
      mode?: 'onBlur' | 'onSubmit' | 'onChange';
      rules?: RegisterOptions<{ test: string }, 'test'>;
      onSubmit?: () => void;
    }) => {
      const internationalMethods = useForm<{ test: string }>({
        resolver,
        mode,
      });
      const {
        register,
        handleSubmit,
        formState: { errors, isValid, isDirty },
      } = internationalMethods;
      methods = internationalMethods;

      return (
        <div>
          <input type="text" {...register('test', resolver ? {} : rules)} />
          <span role="alert">
            {errors?.test?.message && errors.test.message}
          </span>
          <button onClick={handleSubmit(onSubmit)}>button</button>
          <p>{isValid ? 'valid' : 'invalid'}</p>
          <p>{isDirty ? 'dirty' : 'pristine'}</p>
        </div>
      );
    };
    let methods: UseFormReturn<{ test: string }>;

    describe('onSubmit mode', () => {
      it('should not contain error if value is valid', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        expect(alert.textContent).toBe('');
      });

      it('should not contain error if name is invalid', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'wrongName', value: '' },
        });

        expect(alert.textContent).toBe('');
      });

      it('should contain error if value is invalid with revalidateMode is onChange', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} />);

        const input = screen.getByRole('textbox');

        fireEvent.input(input, { target: { name: 'test', value: 'test' } });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        expect(screen.getByRole('alert').textContent).toBe('');

        fireEvent.input(input, { target: { name: 'test', value: '' } });

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should not call reRender method if the current error is the same as the previous error', async () => {
        render(<Component />);

        const input = screen.getByRole('textbox');

        fireEvent.input(input, { target: { name: 'test', value: '' } });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );

        fireEvent.input(input, { target: { name: 'test', value: '' } });

        expect(screen.getByRole('alert').textContent).toBe('required');
      });

      it('should set name to formState.touchedFields when formState.touchedFields is defined', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} rules={{}} />);

        methods.formState.touchedFields;

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        fireEvent.blur(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        await waitFor(() =>
          expect(methods.formState.touchedFields).toEqual({
            test: true,
          }),
        );
        expect(screen.getByRole('alert').textContent).toBe('');
      });

      // check https://github.com/react-hook-form/react-hook-form/issues/2153
      it('should perform correct behavior when reValidateMode is onBlur', async () => {
        const onSubmit = jest.fn();

        const Component = () => {
          const {
            register,
            handleSubmit,
            formState: { errors },
          } = useForm<{
            test: string;
          }>({
            reValidateMode: 'onBlur',
          });
          return (
            <form onSubmit={handleSubmit(onSubmit)}>
              <input type="text" {...register('test', { required: true })} />
              {errors.test && <span role="alert">required</span>}
              <button>submit</button>
            </form>
          );
        };

        render(<Component />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: {
            value: 'test',
          },
        });

        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        fireEvent.input(screen.getByRole('textbox'), {
          target: { value: '' },
        });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        fireEvent.blur(screen.getByRole('textbox'));

        expect(await screen.findByRole('alert')).toBeVisible();
      });
    });

    describe('onChange', () => {
      it('should display error with onChange', async () => {
        render(<Component mode="onChange" />);

        fireEvent.change(screen.getByRole('textbox'), {
          target: {
            value: ' ',
          },
        });

        fireEvent.change(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should display error with onSubmit', async () => {
        render(<Component mode="onChange" />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should not display error with onBlur', async () => {
        render(<Component mode="onChange" />);

        fireEvent.blur(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        expect(screen.getByRole('alert').textContent).toBe('');
      });
    });

    describe('onBlur', () => {
      it('should display error with onBlur', async () => {
        render(<Component mode="onBlur" />);

        fireEvent.blur(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should display error with onSubmit', async () => {
        render(<Component mode="onBlur" />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should not display error with onChange', async () => {
        render(<Component mode="onBlur" />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        expect(screen.getByRole('alert').textContent).toBe('');
      });
    });

    describe('with watch', () => {
      it('should be return undefined or null value', () => {
        const { result } = renderHook(() =>
          useForm<{
            test: string | null;
            test1?: string;
          }>(),
        );

        result.current.register('test');
        result.current.register('test1');

        act(() => {
          result.current.setValue('test', null);
        });

        act(() => {
          result.current.setValue('test1', undefined);
        });

        const test = result.current.watch('test');
        const test1 = result.current.watch('test1');

        expect(test).toBeNull();
        expect(test1).toBeUndefined();
      });

      it('should be called reRender method if isWatchAllRef is true', async () => {
        let watchedField: any;
        const Component = () => {
          const { register, handleSubmit, watch } = useForm<{
            test: string;
          }>();
          watchedField = watch();
          return (
            <form onSubmit={handleSubmit(() => {})}>
              <input {...register('test')} />
              <button>button</button>
            </form>
          );
        };
        render(<Component />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        expect(watchedField).toEqual({ test: 'test' });
      });

      it('should be called reRender method if field is watched', async () => {
        let watchedField: any;
        const Component = () => {
          const { register, handleSubmit, watch } = useForm<{
            test: string;
          }>();
          watchedField = watch('test');
          return (
            <form onSubmit={handleSubmit(() => {})}>
              <input {...register('test')} />
              <button>button</button>
            </form>
          );
        };
        render(<Component />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        expect(watchedField).toBe('test');
      });

      it('should be called reRender method if array field is watched', async () => {
        let watchedField: any;
        const Component = () => {
          const { register, handleSubmit, watch } = useForm<{
            test: string[];
          }>();
          watchedField = watch('test');
          return (
            <form onSubmit={handleSubmit(() => {})}>
              <input {...register('test.0')} />
              <input {...register('test.1')} />
              <input {...register('test.2')} />
              <button>button</button>
            </form>
          );
        };
        render(<Component />);

        fireEvent.input(screen.getAllByRole('textbox')[0], {
          target: { name: 'test.0', value: 'test' },
        });

        expect(watchedField).toEqual(['test', '', '']);
      });
    });

    describe('with resolver', () => {
      it('should contain error if value is invalid with resolver', async () => {
        const resolver = jest.fn(async (data: any) => {
          if (data.test) {
            return { values: data, errors: {} };
          }
          return {
            values: data,
            errors: {
              test: {
                message: 'resolver error',
              },
            },
          };
        });

        render(<Component resolver={resolver} mode="onChange" />);

        methods.formState.isValid;

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });
        expect(await screen.findByText('dirty')).toBeVisible();
        expect(resolver).toHaveBeenCalled();

        expect(screen.getByRole('alert').textContent).toBe('');
        expect(methods.formState.isValid).toBeTruthy();

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: '' },
        });

        await waitFor(() => {
          expect(screen.getByRole('alert')).toHaveTextContent('resolver error');
        });
        expect(resolver).toHaveBeenCalled();
        expect(methods.formState.isValid).toBeFalsy();
      });

      it('with sync resolver it should contain error if value is invalid with resolver', async () => {
        const resolver = jest.fn((data: any) => {
          if (data.test) {
            return { values: data, errors: {} };
          }
          return {
            values: data,
            errors: {
              test: {
                message: 'resolver error',
              },
            },
          };
        });

        render(<Component resolver={resolver} mode="onChange" />);

        methods.formState.isValid;

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        await waitFor(() => expect(methods.formState.isValid).toBe(true));
        expect(screen.getByRole('alert').textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: '' },
        });

        expect(await screen.findByText('invalid')).toBeVisible();
        expect(methods.formState.isValid).toBe(false);
        expect(screen.getByRole('alert')).toHaveTextContent('resolver error');
        expect(resolver).toHaveBeenCalled();
      });

      it('should make isValid change to false if it contain error that is not related name with onChange mode', async () => {
        const resolver = jest.fn(async (data: any) => {
          if (data.test) {
            return { values: data, errors: {} };
          }
          return {
            values: data,
            errors: {
              notRelatedName: {
                message: 'resolver error',
              },
            },
          };
        });

        render(<Component resolver={resolver} mode="onChange" />);

        methods.formState.isValid;

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        await waitFor(() => expect(methods.formState.isValid).toBeTruthy());
        expect(screen.getByRole('alert').textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: '' },
        });

        await waitFor(() => expect(methods.formState.isValid).toBeFalsy());
        expect(resolver).toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toBe('');
      });

      it("should call the resolver with the field being validated when an input's value change", async () => {
        const resolver = jest.fn((values: any) => ({ values, errors: {} }));
        const onSubmit = jest.fn();

        render(
          <Component resolver={resolver} onSubmit={onSubmit} mode="onChange" />,
        );

        expect(await screen.findByText('valid')).toBeVisible();

        const input = screen.getByRole('textbox');

        expect(resolver).toHaveBeenCalledWith(
          {
            test: '',
          },
          undefined,
          {
            criteriaMode: undefined,
            fields: {
              test: {
                mount: true,
                name: 'test',
                ref: input,
              },
            },
            names: ['test'],
            shouldUseNativeValidation: undefined,
          },
        );

        resolver.mockClear();

        fireEvent.input(input, {
          target: { name: 'test', value: 'test' },
        });

        expect(await screen.findByText('dirty')).toBeVisible();

        expect(resolver).toHaveBeenCalledWith(
          {
            test: 'test',
          },
          undefined,
          {
            criteriaMode: undefined,
            fields: {
              test: {
                mount: true,
                name: 'test',
                ref: input,
              },
            },
            names: ['test'],
            shouldUseNativeValidation: undefined,
          },
        );

        resolver.mockClear();

        fireEvent.click(screen.getByText(/button/i));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        expect(resolver).toHaveBeenCalledWith(
          {
            test: 'test',
          },
          undefined,
          {
            criteriaMode: undefined,
            fields: {
              test: {
                mount: true,
                name: 'test',
                ref: input,
              },
            },
            names: ['test'],
            shouldUseNativeValidation: undefined,
          },
        );
      });

      it('should call the resolver with the field being validated when `trigger` is called', async () => {
        const resolver = jest.fn((values: any) => ({ values, errors: {} }));
        const defaultValues = { test: { sub: 'test' }, test1: 'test1' };

        const { result } = renderHook(() =>
          useForm<typeof defaultValues>({
            mode: VALIDATION_MODE.onChange,
            resolver,
            defaultValues,
          }),
        );

        expect(resolver).not.toHaveBeenCalled();

        await act(async () => {
          await result.current.register('test.sub');
          await result.current.register('test1');
        });

        await act(async () => {
          result.current.trigger('test.sub');
        });

        const fields = {
          test: {
            sub: {
              mount: true,
              name: 'test.sub',
              ref: { name: 'test.sub' },
            },
          },
          test1: {
            mount: true,
            name: 'test1',
            ref: {
              name: 'test1',
            },
          },
        };

        expect(resolver).toHaveBeenCalledWith(defaultValues, undefined, {
          criteriaMode: undefined,
          fields,
          names: ['test.sub', 'test1'],
        });

        await act(async () => {
          result.current.trigger();
        });

        expect(resolver).toHaveBeenNthCalledWith(2, defaultValues, undefined, {
          criteriaMode: undefined,
          fields,
          names: ['test.sub', 'test1'],
        });

        await act(async () => {
          result.current.trigger(['test.sub', 'test1']);
        });

        expect(resolver).toHaveBeenNthCalledWith(3, defaultValues, undefined, {
          criteriaMode: undefined,
          fields,
          names: ['test.sub', 'test1'],
        });
      });
    });
  });

  describe('updateValid', () => {
    it('should be called resolver with default values if default value is defined', async () => {
      type FormValues = {
        test: string;
      };

      const resolver = jest.fn(async (data: FormValues) => {
        return {
          values: data,
          errors: {},
        };
      });

      const { result } = renderHook(() =>
        useForm<FormValues>({
          resolver,
          defaultValues: { test: 'default' },
        }),
      );

      const { ref } = result.current.register('test');

      isFunction(ref) &&
        ref({
          target: {
            value: '',
          },
        });

      await act(async () => {
        await result.current.trigger();
      });

      expect(resolver).toHaveBeenCalledWith(
        {
          test: 'default',
        },
        undefined,
        {
          criteriaMode: undefined,
          fields: {
            test: {
              mount: true,
              name: 'test',
              ref: {
                target: {
                  value: '',
                },
                value: 'default',
              },
            },
          },
          names: ['test'],
        },
      );
    });

    it('should be called resolver with field values if value is undefined', async () => {
      type FormValues = {
        test: string;
      };

      const resolver = jest.fn(async (data: FormValues) => {
        return {
          values: data,
          errors: {},
        };
      });

      const { result } = renderHook(() =>
        useForm<FormValues>({
          resolver,
        }),
      );

      result.current.register('test');

      result.current.setValue('test', 'value');

      result.current.trigger();

      expect(resolver).toHaveBeenCalledWith({ test: 'value' }, undefined, {
        criteriaMode: undefined,
        fields: {
          test: {
            mount: true,
            name: 'test',
            ref: { name: 'test', value: 'value' },
          },
        },
        names: ['test'],
      });
    });
  });

  describe('mode with onTouched', () => {
    it('should validate form only when input is been touched', async () => {
      const Component = () => {
        const {
          register,
          formState: { errors },
        } = useForm<{
          test: string;
        }>({
          mode: 'onTouched',
        });

        return (
          <>
            <input
              type="text"
              {...register('test', { required: 'This is required.' })}
            />
            {errors.test?.message}
          </>
        );
      };

      render(<Component />);

      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      fireEvent.blur(input);

      expect(await screen.findByText('This is required.')).toBeVisible();

      fireEvent.input(input, {
        target: {
          value: 'test',
        },
      });

      await waitFor(() =>
        expect(screen.queryByText('This is required.')).not.toBeInTheDocument(),
      );

      fireEvent.input(input, {
        target: {
          value: '',
        },
      });

      expect(await screen.findByText('This is required.')).toBeVisible();
    });

    it('should validate onFocusout event', async () => {
      const Component = () => {
        const {
          register,
          formState: { errors },
        } = useForm<{
          test: string;
        }>({
          mode: 'onTouched',
        });

        return (
          <>
            <input
              type="text"
              {...register('test', { required: 'This is required.' })}
            />
            {errors.test?.message}
          </>
        );
      };

      render(<Component />);

      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      fireEvent.focusOut(input);

      expect(await screen.findByText('This is required.')).toBeVisible();

      fireEvent.input(input, {
        target: {
          value: 'test',
        },
      });

      await waitFor(() =>
        expect(screen.queryByText('This is required.')).not.toBeInTheDocument(),
      );

      fireEvent.input(input, {
        target: {
          value: '',
        },
      });

      expect(await screen.findByText('This is required.')).toBeVisible();
    });
  });

  describe('with schema validation', () => {
    it('should trigger and clear errors for group errors object', async () => {
      let errorsObject = {};

      const Component = () => {
        const {
          formState: { errors },
          register,
          handleSubmit,
        } = useForm<{
          checkbox: string[];
        }>({
          mode: 'onChange',
          resolver: (data) => {
            return {
              errors: {
                ...(data.checkbox.every((value) => !value)
                  ? { checkbox: { type: 'error', message: 'wrong' } }
                  : {}),
              },
              values: {},
            };
          },
        });
        errorsObject = errors;

        return (
          <form onSubmit={handleSubmit(() => {})}>
            {[1, 2, 3].map((value, index) => (
              <div key={`test.${index}`}>
                <label
                  htmlFor={`checkbox.${index}`}
                >{`checkbox.${index}`}</label>
                <input
                  type={'checkbox'}
                  key={index}
                  id={`checkbox.${index}`}
                  {...register(`checkbox.${index}` as const)}
                  value={value}
                />
              </div>
            ))}

            <button>Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: { type: 'error', message: 'wrong' },
        }),
      );

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      await waitFor(() => expect(errorsObject).toEqual({}));

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: { type: 'error', message: 'wrong' },
        }),
      );

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      await waitFor(() => expect(errorsObject).toEqual({}));
    });

    it('should not clear errors for non checkbox parent inputs', async () => {
      let errorsObject = {};

      const Component = () => {
        const {
          formState: { errors },
          register,
          handleSubmit,
        } = useForm<{
          checkbox: [{ test: string }, { test1: string }];
        }>({
          mode: 'onChange',
          resolver: (data) => {
            return {
              errors: {
                ...(!data.checkbox[0].test || !data.checkbox[1].test1
                  ? {
                      checkbox: [
                        {
                          ...(!data.checkbox[0].test
                            ? { test: { type: 'error', message: 'wrong' } }
                            : {}),
                          ...(!data.checkbox[1].test1
                            ? { test1: { type: 'error', message: 'wrong' } }
                            : {}),
                        },
                      ],
                    }
                  : {}),
              },
              values: {},
            };
          },
        });
        errorsObject = errors;

        return (
          <form onSubmit={handleSubmit(() => {})}>
            <input type={'checkbox'} {...register(`checkbox.0.test`)} />

            <input {...register(`checkbox.1.test1`)} />
            <button>Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: [
            {
              test: { type: 'error', message: 'wrong' },
              test1: { type: 'error', message: 'wrong' },
            },
          ],
        }),
      );

      fireEvent.click(screen.getByRole('checkbox'));

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: [
            {
              test1: { type: 'error', message: 'wrong' },
            },
          ],
        }),
      );
    });

    it('should have formState.isValid equals true with defined default values after executing resolver', async () => {
      const Toggle = () => {
        const [toggle, setToggle] = React.useState(false);

        const { register, formState } = useForm({
          defaultValues: { test: 'Test' },
          mode: 'onChange',
          resolver: async (values) => {
            if (!values.test) {
              const result = {
                values: {},
                errors: {
                  test: {
                    type: 'required',
                  },
                },
              };
              return result;
            }

            return {
              values,
              errors: {},
            };
          },
        });

        return (
          <>
            <button onClick={() => setToggle(!toggle)}>Toggle</button>
            {toggle && <input id="test" {...register('test')} />}
            <button disabled={!formState.isValid}>Submit</button>
          </>
        );
      };

      render(<Toggle />);

      const toggle = () => fireEvent.click(screen.getByText('Toggle'));

      toggle();

      await waitFor(() => expect(screen.getByText('Submit')).toBeEnabled());

      toggle();
      toggle();

      expect(screen.getByText('Submit')).toBeEnabled();
    });
  });

  describe('control', () => {
    it('does not change across re-renders', () => {
      let control;

      const Component = () => {
        const form = useForm<{
          test: string;
        }>();

        control = form.control;

        return (
          <>
            <input type="text" {...form.register('test')} />
          </>
        );
      };

      const { rerender } = render(<Component />);

      const firstRenderControl = control;

      rerender(<Component />);

      const secondRenderControl = control;

      expect(Object.is(firstRenderControl, secondRenderControl)).toBe(true);
    });
  });

  describe('when input is not registered', () => {
    it('trigger should not throw warn', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );

      await act(async () =>
        expect(await result.current.trigger('test')).toBeTruthy(),
      );
    });
  });

  it('should unsubscribe to all subject when hook unmounts', () => {
    let tempControl: any;

    const App = () => {
      const { control } = useForm();
      tempControl = control;

      return null;
    };

    const { unmount } = render(<App />);

    expect(tempControl._subjects.state.observers.length).toBeTruthy();

    unmount();

    expect(tempControl._subjects.state.observers.length).toBeFalsy();
  });

  it('should update isValidating to true when other validation still running', async () => {
    jest.useFakeTimers();

    function App() {
      const [stateValidation, setStateValidation] = React.useState(false);
      const {
        register,
        formState: { isValidating },
      } = useForm({ mode: 'all' });

      return (
        <div>
          <p>isValidating: {String(isValidating)}</p>
          <p>stateValidation: {String(stateValidation)}</p>
          <form>
            <input
              {...register('lastName', {
                required: true,
                validate: () => {
                  setStateValidation(true);
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      setStateValidation(false);
                      resolve(true);
                    }, 5000);
                  });
                },
              })}
              placeholder="async"
            />

            <input
              {...register('firstName', { required: true })}
              placeholder="required"
            />
          </form>
        </div>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('async'), {
      target: { value: 'test' },
    });
    fireEvent.change(screen.getByPlaceholderText('required'), {
      target: { value: 'test' },
    });

    screen.getByText('isValidating: true');
    screen.getByText('stateValidation: true');

    await actComponent(async () => {
      jest.runAllTimers();
    });

    screen.getByText('isValidating: false');
    screen.getByText('stateValidation: false');
  });

  it('should update defaultValues async', async () => {
    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    const App = () => {
      const {
        register,
        formState: { isLoading },
      } = useForm<{ test: string }>({
        defaultValues: async () => {
          await sleep(100);

          return {
            values: {
              test: 'test',
            },
          };
        },
      });

      return (
        <form>
          <input {...register('test')} />
          <p>{isLoading ? 'loading...' : 'done'}</p>
        </form>
      );
    };

    render(<App />);

    await waitFor(() => {
      screen.getByText('loading...');
    });

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
        'test',
      );
    });

    await waitFor(() => {
      screen.getByText('done');
    });
  });
});
